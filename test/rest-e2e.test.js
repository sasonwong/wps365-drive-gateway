// 端到端：用真实 rustic 客户端跑完整生命周期（init/backup/check --read-data/
// forget --prune/restore），验证 REST 层对第三方实现的兼容性。
// rusty 的 REST 客户端比 restic 更严格（只认 v2 列举、DELETE 用 error_for_status），
// 所以它能过基本代表 restic 也能过。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createRestApp } from "../src/rest.js";
import { makeFakeWps } from "./fake-wps.js";

const hasRustic = spawnSync("rustic", ["--version"], { encoding: "utf8" }).status === 0;

test("rustic 全生命周期", { skip: !hasRustic && "rustic 未安装" }, async () => {
  const fake = makeFakeWps({ pageSize: 5 });
  await fake.listen();
  const app = express();
  app.use("/rest", createRestApp({
    wps: fake.wps,
    buckets: [{ name: "personal", driveId: "drive-1" }],
    creds: [{ accessKey: "user", secretKey: "pass" }],
    uploadConcurrency: 2,
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const repo = `rest:http://user:pass@127.0.0.1:${server.address().port}/rest/personal/backups/repo/`;

  const src = fs.mkdtempSync(path.join(os.tmpdir(), "wps-rest-src-"));
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), "wps-rest-dst-"));
  // 必须异步 spawn：网关跑在本进程里，spawnSync 会卡住事件循环导致死锁
  const run = (...args) => new Promise((resolve, reject) => {
    const p = spawn("rustic", ["-r", repo, "--password", "test", "--no-progress", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    const timer = setTimeout(() => p.kill("SIGKILL"), 30_000);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`rustic ${args.join(" ")} 退出码 ${code}\n${out}\n${err}`));
    });
  });

  try {
    fs.writeFileSync(path.join(src, "a.txt"), "version 1");
    fs.mkdirSync(path.join(src, "sub"));
    const big = crypto.randomBytes(400 * 1024); // 跨多个 Range 读取
    fs.writeFileSync(path.join(src, "sub", "b.bin"), big);

    await run("init");
    await run("backup", src);
    assert.equal(JSON.parse(await run("snapshots", "--json")).length, 1);

    fs.writeFileSync(path.join(src, "a.txt"), "version 2");
    fs.rmSync(path.join(src, "sub", "b.bin"));
    fs.writeFileSync(path.join(src, "c.txt"), "only in v2");
    await run("backup", src);

    await run("check", "--read-data");            // 读全量 pack：验 Range + 大小
    await run("forget", "--keep-last", "1", "--prune"); // 删旧 pack/index/snapshot
    await run("check", "--read-data");            // prune 后的仓库仍自洽

    await run("restore", "latest", dst);
    // rustic 会保留源绝对路径（dst/tmp/.../a.txt），递归找文件
    const restored = fs.readdirSync(dst, { recursive: true });
    const at = (name) => path.join(dst, restored.find((f) => f === name || f.endsWith(`/${name}`)));
    assert.equal(fs.readFileSync(at("a.txt"), "utf8"), "version 2");
    assert.equal(fs.readFileSync(at("c.txt"), "utf8"), "only in v2");
    assert.equal(restored.some((f) => f.endsWith("b.bin")), false);

    // 仓库里剩下的对象都应该能按 SHA-256 命名校验通过（POST 时已验），这里再确认非空
    const repoDir = (await fake.allChildren("0")).find((n) => n.name === "backups");
    assert.ok(repoDir);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await fake.close();
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dst, { recursive: true, force: true });
  }
});
