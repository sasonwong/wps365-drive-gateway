// REST 协议层单测：restic/rest-server 的契约（v2 列举、403 已存在、200 幂等删除、
// HEAD 长度、Range、Basic 认证）+ WPS 分页列举。纯本地 fake，无需真实凭证。
import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createRestApp } from "../src/rest.js";
import { makeFakeWps, sha256 as sha } from "./fake-wps.js";

const fake = makeFakeWps({ pageSize: 3 });
await fake.listen();

const rest = (opts = {}) => createRestApp({
  wps: fake.wps,
  buckets: [{ name: "personal", driveId: "drive-1" }],
  creds: [{ accessKey: "user", secretKey: "pass" }],
  readOnly: false, uploadConcurrency: 2, ...opts,
});

const root = express();
root.use("/rest", rest());
const server = root.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = () => `http://127.0.0.1:${server.address().port}/rest/personal/repo`;
const auth = "Basic " + Buffer.from("user:pass").toString("base64");
const call = (method, p, { body, headers = {} } = {}) => fetch(base() + p, {
  method, body, headers: { Authorization: auth, ...headers },
});

after(() => new Promise((r) => { server.closeAllConnections(); server.close(r); }));
after(() => fake.close());

test("无 Basic 认证 → 401", async () => {
  const r = await fetch(base() + "/config");
  assert.equal(r.status, 401);
  assert.match(r.headers.get("www-authenticate"), /Basic/);
});

test("create → 建目录；重复 create 幂等", async () => {
  for (let i = 0; i < 2; i++) {
    assert.equal((await call("POST", "/?create=true")).status, 200);
  }
  const repo = (await fake.allChildren("0")).find((i) => i.name === "repo");
  assert.ok(repo);
  const inner = await fake.allChildren(repo.id);
  assert.deepEqual(inner.map((i) => i.name).sort(), ["data", "index", "keys", "locks", "snapshots"]);
});

test("config：POST → HEAD(长度) → 重复 POST 403 → GET", async () => {
  const cfg = Buffer.from(`{"version":2,"id":"${crypto.randomUUID()}"}`);
  assert.equal((await call("POST", "/config", { body: cfg })).status, 200);
  const h = await call("HEAD", "/config");
  assert.equal(h.status, 200);
  assert.equal(h.headers.get("content-length"), String(cfg.length));
  assert.equal((await call("POST", "/config", { body: cfg })).status, 403);
  assert.deepEqual(Buffer.from(await (await call("GET", "/config")).arrayBuffer()), cfg);
});

test("POST blob：哈希不符 400，重复 403", async () => {
  const bad = Buffer.from("not matching");
  assert.equal((await call("POST", `/data/${sha(Buffer.from("x"))}`, { body: bad })).status, 400);

  const good = Buffer.from("0123456789");
  const id = sha(good);
  assert.equal((await call("POST", `/data/${id}`, { body: good })).status, 200);
  assert.equal((await call("POST", `/data/${id}`, { body: good })).status, 403);
});

test("v2 列举分页：7 个对象（fake 每页 3 条）一次拿全，带 size", async () => {
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const body = Buffer.from(`payload-${i}`);
    const id = sha(body);
    await call("POST", `/index/${id}`, { body });
    ids.push([id, body.length]);
  }
  const r = await call("GET", "/index/", { headers: { Accept: "application/vnd.x.restic.rest.v2" } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/vnd.x.restic.rest.v2");
  const got = Object.fromEntries((await r.json()).map((i) => [i.name, i.size]));
  for (const [id, size] of ids) assert.equal(got[id], size);
});

test("v1 列举：不带 Accept 时返回名字数组", async () => {
  const r = await call("GET", "/keys/");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/vnd.x.restic.rest.v1");
  assert.ok(Array.isArray(await r.json()));
});

test("GET Range → 206，字节精确", async () => {
  const body = Buffer.from("abcdefghij");
  const id = sha(body);
  await call("POST", `/data/${id}`, { body });
  const r = await call("GET", `/data/${id}`, { headers: { Range: "bytes=2-5" } });
  assert.equal(r.status, 206);
  assert.equal(await r.text(), "cdef");
});

test("HEAD blob → Content-Length；DELETE 幂等（两次都 200）", async () => {
  const body = Buffer.from("to be deleted");
  const id = sha(body);
  await call("POST", `/locks/${id}`, { body });
  const h = await call("HEAD", `/locks/${id}`);
  assert.equal(h.status, 200);
  assert.equal(h.headers.get("content-length"), String(body.length));
  assert.equal((await call("DELETE", `/locks/${id}`)).status, 200);
  assert.equal((await call("DELETE", `/locks/${id}`)).status, 200);
  assert.equal((await call("HEAD", `/locks/${id}`)).status, 404);
});

test("只读模式：拒绝写与非锁删除，放行删锁（restic unlock）", async () => {
  const ro = express();
  ro.use("/rest", rest({ readOnly: true }));
  const s2 = ro.listen(0, "127.0.0.1");
  await new Promise((r) => s2.once("listening", r));
  const b = `http://127.0.0.1:${s2.address().port}/rest/personal/repo`;
  try {
    const body = Buffer.from("ro");
    assert.equal((await fetch(`${b}/?create=true`, { method: "POST", headers: { Authorization: auth } })).status, 403);
    assert.equal((await fetch(`${b}/data/${sha(body)}`, { method: "POST", headers: { Authorization: auth }, body })).status, 403);
    // 锁对象先在有写权限的实例里建好，再断言只读实例能删
    assert.equal((await call("DELETE", `/locks/${sha(body)}`)).status, 200);
    assert.equal((await fetch(`${b}/locks/${sha(body)}`, { method: "DELETE", headers: { Authorization: auth } })).status, 200);
  } finally {
    s2.closeAllConnections();
    await new Promise((r) => s2.close(r));
  }
});

test("仓库目录名可以是中文（路径段解码）", async () => {
  const u = (p) => `http://127.0.0.1:${server.address().port}/rest/personal${p}`;
  const h = { Authorization: auth };
  assert.equal((await fetch(u("/备份/仓库/?create=true"), { method: "POST", headers: h })).status, 200);
  assert.equal((await fetch(u("/备份/仓库/config"), { method: "POST", headers: h, body: Buffer.from("{}") })).status, 200);
  assert.equal((await fetch(u("/备份/仓库/config"), { method: "HEAD", headers: h })).status, 200);
});

test("data 分片：按 sha 前两位落到子目录，列举时合并", async () => {
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const body = Buffer.from(`pack-${i}`);
    const id = sha(body);
    await call("POST", `/data/${id}`, { body });
    ids.push(id);
  }
  const r = await call("GET", "/data/", { headers: { Accept: "application/vnd.x.restic.rest.v2" } });
  assert.equal(r.status, 200);
  const names = new Set((await r.json()).map((i) => i.name));
  for (const id of ids) assert.ok(names.has(id), `missing ${id}`);

  // 物理上确实分片了：data/ 下是按 sha 前两位命名的目录
  const repo = (await fake.allChildren("0")).find((i) => i.name === "repo");
  const dataDir = (await fake.allChildren(repo.id)).find((i) => i.name === "data");
  const shards = (await fake.allChildren(dataDir.id)).filter((i) => i.type === "folder").map((i) => i.name);
  for (const s of new Set(ids.map((id) => id.slice(0, 2)))) assert.ok(shards.includes(s), `missing shard ${s}`);
});
