// WPS 客户端限流重试单测：429000001 退避 1s/2s 后成功（本地 fake server，无真实凭证）
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WpsClient } from "../src/wps.js";

function makeClient(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(0, () => {
    const port = server.address().port;
    const tokenFile = path.join(os.tmpdir(), `wps-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(tokenFile, JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600_000 }));
    const wps = new WpsClient({ apiBase: `http://127.0.0.1:${port}`, tokenUrl: `http://127.0.0.1:${port}/oauth2/token`, clientId: "c", clientSecret: "s", kso1Sign: false }, tokenFile);
    resolve({ server, wps, tokenFile });
  }));
}

test("request() 限流 429000001 退避 1s/2s 后成功", async () => {
  let calls = 0;
  const { server, wps, tokenFile } = await makeClient((req, res) => {
    calls++;
    if (calls <= 2) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 429000001, msg: "throttled" }));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0, data: { ok: true } }));
    }
  });
  try {
    const t0 = Date.now();
    const data = await wps.request("GET", "/v7/test");
    assert.deepEqual(data, { ok: true });
    assert.equal(calls, 3);                                  // 限流 2 次 + 成功 1 次
    assert.ok(Date.now() - t0 >= 2800, `退避不足: ${Date.now() - t0}ms`); // 1s + 2s
  } finally {
    server.close();
    fs.rmSync(tokenFile);
  }
});

test("request() 非限流错误不重试，直接抛错", async () => {
  let calls = 0;
  const { server, wps, tokenFile } = await makeClient((req, res) => {
    calls++;
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: 400000004, msg: "real error" }));
  });
  try {
    await assert.rejects(wps.request("GET", "/v7/test"), /real error/);
    assert.equal(calls, 1);
  } finally {
    server.close();
    fs.rmSync(tokenFile);
  }
});

test("save() 原子写 token：内容完整、权限 600、不残留 .tmp", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wps-save-"));
  const tokenFile = path.join(dir, "tokens.json");
  const wps = new WpsClient({ clientId: "c", clientSecret: "s" }, tokenFile);
  wps.accessToken = "a"; wps.refreshToken = "r"; wps.expiresAt = 123;

  wps.save();

  assert.deepEqual(JSON.parse(fs.readFileSync(tokenFile, "utf8")),
    { access_token: "a", refresh_token: "r", expires_at: 123 });
  assert.equal(fs.statSync(tokenFile).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(`${tokenFile}.tmp`), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("refresh() 采信 tokens.json 里已被别的进程轮换的 refresh_token", async () => {
  let gotRefresh = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      gotRefresh = new URLSearchParams(body).get("refresh_token");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "a2", refresh_token: "r2", expires_in: 3600 }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wps-adopt-"));
  const tokenFile = path.join(dir, "tokens.json");
  fs.writeFileSync(tokenFile, JSON.stringify({ access_token: "a1", refresh_token: "r1", expires_at: 0 }));
  const wps = new WpsClient({ tokenUrl: `http://127.0.0.1:${port}/oauth2/token`, clientId: "c", clientSecret: "s", kso1Sign: false }, tokenFile);

  // 模拟另一个进程做过一次 refresh 并轮换了 refresh_token
  fs.writeFileSync(tokenFile, JSON.stringify({ access_token: "a1b", refresh_token: "r1-new", expires_at: 0 }));
  try {
    await wps.refresh();
    assert.equal(gotRefresh, "r1-new");                                        // 用的是文件里的新值
    assert.equal(wps.accessToken, "a2");                                       // 采纳服务端返回
    assert.equal(JSON.parse(fs.readFileSync(tokenFile, "utf8")).refresh_token, "r2");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("网络抖动重试：GET 自动重试，POST 默认不重试，重试次数用尽才抛错", async () => {
  const wps = new WpsClient({ apiBase: "http://127.0.0.1:1", kso1Sign: false }, path.join(os.tmpdir(), "no-such-tokens.json"));
  let n = 0;
  const r = await wps.fetchRetry(async () => {
    if (++n < 3) throw new TypeError("fetch failed");
    return "ok";
  });
  assert.equal(r, "ok");
  assert.equal(n, 3);

  let m = 0;
  await assert.rejects(() => wps.fetchRetry(async () => { m++; throw new TypeError("fetch failed"); }));
  assert.equal(m, 3);                                   // 2 次重试后再抛

  let k = 0;
  await assert.rejects(() => wps.fetchRetry(async () => { k++; throw new TypeError("fetch failed"); }, false));
  assert.equal(k, 1);                                   // disabled 时只试一次
});

test("request() 的 GET 会重试网络错误，POST 不会", async () => {
  const orig = globalThis.fetch;
  const wps = () => {
    const w = new WpsClient({ apiBase: "http://fake", kso1Sign: false }, path.join(os.tmpdir(), "no-such-tokens.json"));
    w.accessToken = "t";
    w.expiresAt = Date.now() + 60000;
    return w;
  };
  try {
    // GET：第一次 fetch 抛错，重试后成功
    let calls = 0;
    globalThis.fetch = async () => {
      if (++calls === 1) throw new TypeError("fetch failed");
      return { ok: true, status: 200, json: async () => ({ code: 0, data: "ok" }) };
    };
    assert.equal(await wps().request("GET", "/x"), "ok");
    assert.equal(calls, 2);

    // POST：不重试，只发一次
    calls = 0;
    globalThis.fetch = async () => { calls++; throw new TypeError("fetch failed"); };
    await assert.rejects(() => wps().request("POST", "/y", {}));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = orig;
  }
});
