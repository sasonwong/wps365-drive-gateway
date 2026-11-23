// WPS365 Drive Gateway 入口
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WpsClient } from "./wps.js";
import { parseRate } from "./throttle.js";
import { createS3App } from "./s3.js";
import { createRestApp } from "./rest.js";
import { mergeBuckets, missingBuckets } from "./buckets.js";

// 网关是常驻代理：网络抖动的单次失败不该让整个服务退出（挂了就所有备份/客户端一起停）。
// 兜底记录后继续跑；真正的 bug 会在日志里留下堆栈。
process.on("unhandledRejection", (e) => console.error("[gateway] 未捕获的 promise 拒绝:", e?.stack ?? e));
process.on("uncaughtException", (e) => console.error("[gateway] 未捕获异常:", e?.stack ?? e));

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = process.env.WPS_GATEWAY_CONFIG ?? path.join(root, "config.json");

const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const tokenFile = process.env.WPS_GATEWAY_TOKEN ?? path.join(root, "tokens.json");

const rates = {
  upload: parseRate(cfg.uploadRate),
  download: parseRate(cfg.downloadRate),
};
const uploadConcurrency = cfg.uploadConcurrency ?? 2;
const wps = new WpsClient(cfg.wps, tokenFile, rates);

// 首次运行：设备码登录
if (!wps.accessToken) {
  await wps.login(cfg.wps.scopes);
} else {
  try { await wps.ensureToken(); } catch (e) { console.warn("token 刷新失败，尝试重新登录:", e.message); await wps.login(cfg.wps.scopes); }
}

// 发现盘：校验配置、按需自动注册未配置的盘（autoBuckets）
let buckets = cfg.buckets;
try {
  const [drives, doclibs] = await Promise.all([wps.listDrives().catch(() => null), wps.listDoclibs().catch(() => null)]);
  const found = {
    drives: (drives?.items ?? []).map((d) => ({ id: d.id, name: d.name })),
    doclibs: (doclibs?.items ?? []).map((d) => ({ id: (d.drive ?? d).id, name: (d.drive ?? d).name })),
  };
  for (const b of missingBuckets(cfg.buckets, found)) {
    console.warn(`[config] bucket "${b.name}" 的 driveId ${b.driveId} 不在可访问列表中，请检查`);
  }
  const merged = mergeBuckets(cfg.buckets, found, cfg.autoBuckets ?? false);
  buckets = merged.buckets;
  if (merged.added.length) {
    console.log(`[config] autoBuckets: 发现 ${found.drives.length + found.doclibs.length} 个盘，自动注册 ${merged.added.length} 个未配置的：${merged.added.map((b) => b.name).join(", ")}`);
  }
} catch { /* 非致命 */ }

const app = express();
// REST 挂在 S3 之前：S3 的中间件会把整个请求体读进内存，restic 的 pack 不能走那条路
app.use("/rest", createRestApp({
  wps,
  buckets,
  creds: cfg.s3Credentials,
  readOnly: cfg.readOnly ?? false,
  appendOnlyPaths: cfg.appendOnlyPaths ?? [],
  uploadConcurrency,
}));
app.use(createS3App({
  wps,
  buckets,
  creds: cfg.s3Credentials,
  readOnly: cfg.readOnly ?? false,
  appendOnlyPaths: cfg.appendOnlyPaths ?? [],
  pruneEmptyDirs: cfg.pruneEmptyDirs ?? true,
  cacheTtlMs: cfg.cacheTtlMs ?? 30_000,
  listConcurrency: cfg.listConcurrency ?? 16,
  uploadConcurrency,
}));

app.listen(cfg.port ?? 9000, cfg.host ?? "127.0.0.1", () => {
  console.log(`\nWPS365 Drive Gateway 已启动: http://${cfg.host ?? "127.0.0.1"}:${cfg.port ?? 9000}`);
  console.log(`S3 凭证: ${cfg.s3Credentials.map((c) => c.accessKey).join(", ")}`);
  console.log(`Buckets: ${buckets.map((b) => b.name).join(", ")}${cfg.readOnly ? " (只读)" : ""}`);
  console.log(`restic REST: rest:http://<user>:<pass>@${cfg.host ?? "127.0.0.1"}:${cfg.port ?? 9000}/rest/<bucket>/<repo 路径>/`);
  const fmt = (n) => (n ? `${(n / 1048576).toFixed(1)} MiB/s` : "不限");
  console.log(`限速: 上传 ${fmt(rates.upload)}，下载 ${fmt(rates.download)}，写并发 ${uploadConcurrency}\n`);
});
