// WPS365 Drive Gateway 入口
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WpsClient } from "./wps.js";
import { parseRate } from "./throttle.js";
import { createS3App } from "./s3.js";

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

// 校验 bucket 映射：列出可用盘，提示缺失的 driveId
try {
  const [drives, doclibs] = await Promise.all([wps.listDrives().catch(() => null), wps.listDoclibs().catch(() => null)]);
  const known = new Set([
    ...(drives?.items ?? []).map((d) => d.id),
    ...(doclibs?.items ?? []).map((d) => d.drive?.id),
  ]);
  for (const b of cfg.buckets) {
    if (!known.has(b.driveId)) console.warn(`[config] bucket "${b.name}" 的 driveId ${b.driveId} 不在可访问列表中，请检查`);
  }
} catch { /* 非致命 */ }

const app = createS3App({
  wps,
  buckets: cfg.buckets,
  creds: cfg.s3Credentials,
  readOnly: cfg.readOnly ?? false,
  pruneEmptyDirs: cfg.pruneEmptyDirs ?? true,
  cacheTtlMs: cfg.cacheTtlMs ?? 30_000,
  listConcurrency: cfg.listConcurrency ?? 16,
  uploadConcurrency,
});

app.listen(cfg.port ?? 9000, cfg.host ?? "127.0.0.1", () => {
  console.log(`\nWPS365 Drive Gateway 已启动: http://${cfg.host ?? "127.0.0.1"}:${cfg.port ?? 9000}`);
  console.log(`S3 凭证: ${cfg.s3Credentials.map((c) => c.accessKey).join(", ")}`);
  console.log(`Buckets: ${cfg.buckets.map((b) => b.name).join(", ")}${cfg.readOnly ? " (只读)" : ""}`);
  const fmt = (n) => (n ? `${(n / 1048576).toFixed(1)} MiB/s` : "不限");
  console.log(`限速: 上传 ${fmt(rates.upload)}，下载 ${fmt(rates.download)}，写并发 ${uploadConcurrency}\n`);
});
