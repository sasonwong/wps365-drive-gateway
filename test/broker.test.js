// token broker：鉴权、按需刷新、并发只刷一次、设备码登录流转、客户端模式
import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createBrokerApp } from "../src/broker.js";
import { WpsClient } from "../src/wps.js";

const TOKEN = "bearer-sg";
const AUTH = { Authorization: `Bearer ${TOKEN}` };

// 假 WPS：refresh 带 20ms 延迟，用来暴露并发抢跑
function makeFake({ expired = false } = {}) {
  const w = {
    accessToken: expired ? null : "at-0",
    expiresAt: expired ? 0 : Date.now() + 3600_000,
    refreshes: 0,
    logins: 0,
    async refresh() {
      w.refreshes++;
      await new Promise((r) => setTimeout(r, 20));
      w.accessToken = `at-${w.refreshes}`;
      w.expiresAt = Date.now() + 3600_000;
    },
    async startLogin() {
      w.logins++;
      return { verification_uri: "https://example.test/verify", user_code: "ABCD-EFGH", device_code: "dc", interval: 0, expires_in: 600 };
    },
    async pollLogin() {
      await new Promise((r) => setTimeout(r, 10));
      w.accessToken = "at-login";
      w.expiresAt = Date.now() + 3600_000;
    },
  };
  return w;
}

async function serve(fake, opts = {}) {
  const app = express();
  app.use("/oauth", createBrokerApp({ wps: fake, tokens: [{ name: "sg", token: TOKEN }], scopes: "s", ...opts }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return { url: `http://127.0.0.1:${server.address().port}/oauth`, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) };
}

test("无 Bearer / 错 Bearer → 401", async () => {
  const s = await serve(makeFake());
  try {
    assert.equal((await fetch(`${s.url}/token`)).status, 401);
    assert.equal((await fetch(`${s.url}/token`, { headers: { Authorization: "Bearer nope" } })).status, 401);
  } finally { await s.close(); }
});

test("/token：本地 token 有效时直接返回，不触发刷新", async () => {
  const fake = makeFake();
  const s = await serve(fake);
  try {
    const r = await fetch(`${s.url}/token`, { headers: AUTH });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.access_token, "at-0");
    assert.ok(d.expires_at > Date.now());
    assert.equal(fake.refreshes, 0);
  } finally { await s.close(); }
});

test("/token：过期时刷新一次后返回", async () => {
  const fake = makeFake({ expired: true });
  const s = await serve(fake);
  try {
    const d = await (await fetch(`${s.url}/token`, { headers: AUTH })).json();
    assert.equal(d.access_token, "at-1");
    assert.equal(fake.refreshes, 1);
  } finally { await s.close(); }
});

test("并发 5 个 /token 只刷新一次（refresh_token 单次使用，抢跑会互相作废）", async () => {
  const fake = makeFake({ expired: true });
  const s = await serve(fake);
  try {
    const all = await Promise.all(Array.from({ length: 5 }, () => fetch(`${s.url}/token`, { headers: AUTH }).then((r) => r.json())));
    assert.equal(fake.refreshes, 1);
    assert.ok(all.every((d) => d.access_token === "at-1"));
  } finally { await s.close(); }
});

test("POST /refresh：强制刷新，即使本地 token 还没过期", async () => {
  const fake = makeFake();
  const s = await serve(fake);
  try {
    const d = await (await fetch(`${s.url}/refresh`, { method: "POST", headers: AUTH })).json();
    assert.equal(d.access_token, "at-1");
    assert.equal(fake.refreshes, 1);
  } finally { await s.close(); }
});

test("/login：首次返回链接并回调通知，授权完成后 token 可用", async () => {
  const fake = makeFake({ expired: true });
  const seen = [];
  const s = await serve(fake, { onLoginRequired: (u) => seen.push(u) });
  try {
    const d = await (await fetch(`${s.url}/login`, { headers: AUTH })).json();
    assert.equal(d.url, "https://example.test/verify?user_code=ABCD-EFGH");
    assert.deepEqual(seen, [d.url]);
    assert.equal(fake.logins, 1);
    // 第二次调用复用同一个链接，不重复发起授权
    assert.equal((await (await fetch(`${s.url}/login`, { headers: AUTH })).json()).url, d.url);
    assert.equal(fake.logins, 1);
    // 等后台轮询完成
    await new Promise((r) => setTimeout(r, 60));
    const t = await (await fetch(`${s.url}/token`, { headers: AUTH })).json();
    assert.equal(t.access_token, "at-login");
  } finally { await s.close(); }
});

test("/status：报告健康状态与已登记的客户端", async () => {
  const fake = makeFake();
  const s = await serve(fake);
  try {
    const d = await (await fetch(`${s.url}/status`, { headers: AUTH })).json();
    assert.equal(d.ok, true);
    assert.deepEqual(d.clients, ["sg"]);
    assert.equal(d.login_pending, false);
  } finally { await s.close(); }
});

test("WpsClient 客户端模式：ensureToken 向 broker 取，401 后 refresh 也走 broker", async () => {
  const fake = makeFake({ expired: true });
  const s = await serve(fake);
  try {
    const wps = new WpsClient({ tokenUrl: "http://127.0.0.1:1/token" }, "/nonexistent/tokens.json", {}, { url: s.url, token: TOKEN });
    await wps.ensureToken();
    assert.equal(wps.accessToken, "at-1");
    assert.equal(fake.refreshes, 1);
    // 客户端本地过期再取：broker 的 token 还有效，原样返回（不白刷）
    wps.expiresAt = 0;
    await wps.ensureToken();
    assert.equal(wps.accessToken, "at-1");
    assert.equal(fake.refreshes, 1);
    // WPS 返回 401 时的路径：强制刷新走 broker 的 /refresh
    await wps.refresh();
    assert.equal(wps.accessToken, "at-2");
    assert.equal(fake.refreshes, 2);
  } finally { await s.close(); }
});

test("刷新遇到 401 → 自动发起重授权并回调通知（网络抖动则不发）", async () => {
  const fake = makeFake({ expired: true });
  const seen = [];
  let failWith = "refresh failed: 401";
  fake.refresh = async () => { throw new Error(failWith); };
  const s = await serve(fake, { onLoginRequired: (u) => seen.push(u) });
  try {
    assert.equal((await fetch(`${s.url}/token`, { headers: AUTH })).status, 503);
    assert.equal(seen.length, 1, "401 应触发一次设备码链接");
    assert.match(seen[0], /user_code=/);

    // 网络类错误不再发起授权
    seen.length = 0;
    failWith = "fetch failed";
    assert.equal((await fetch(`${s.url}/refresh`, { method: "POST", headers: AUTH })).status, 503);
    assert.equal(seen.length, 0, "网络错误不应刷设备码");
  } finally { await s.close(); }
});
