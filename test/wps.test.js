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
