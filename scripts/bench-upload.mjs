// 上传稳定性测试：经本机网关向 WPS 写定长对象，逐次报告耗时/吞吐/错误。
// 用来区分"偶发抖动"和"链路根本走不通"。
// 用法：
//   node scripts/bench-upload.mjs                 # 10 MiB × 5 次
//   node scripts/bench-upload.mjs 20 3            # 20 MiB × 3 次
//   node scripts/bench-upload.mjs 10 5 personal/_bench
// 注意：会在 bucket 里建临时对象，每次成功后立即删除；不走 append-only 路径。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import aws4 from "aws4";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg = JSON.parse(
  fs.readFileSync(process.env.WPS_GATEWAY_CONFIG ?? path.join(root, "config.json"), "utf8"),
);
const [mbArg, timesArg, prefixArg] = process.argv.slice(2);
const mb = Number(mbArg ?? 10);
const times = Number(timesArg ?? 5);
const prefix = (prefixArg ?? "personal/_bench").replace(/^\/|\/$/g, "");
const host = `${cfg.host ?? "127.0.0.1"}:${cfg.port ?? 9000}`;
const { accessKey, secretKey } = cfg.s3Credentials[0];

const body = crypto.randomBytes(mb * 1048576);
let ok = 0, bad = 0, totalMs = 0;
for (let i = 0; i < times; i++) {
  const key = `${prefix}/probe-${Date.now()}-${i}.bin`;
  const t0 = Date.now();
  try {
    const req = aws4.sign(
      { host, path: `/${key}`, method: "PUT", body, headers: { host, "content-type": "application/octet-stream" } },
      { accessKeyId: accessKey, secretAccessKey: secretKey },
    );
    const r = await fetch(`http://${host}/${key}`, { method: "PUT", headers: req.headers, body });
    const ms = Date.now() - t0;
    totalMs += ms;
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 100)}`);
    ok++;
    console.log(`  #${i + 1} ${mb} MiB  ${(ms / 1000).toFixed(1)}s  ${(mb / (ms / 1000)).toFixed(2)} MiB/s`);
    // 清理（在 append-only 路径外，可删）
    const del = aws4.sign(
      { host, path: `/${key}`, method: "DELETE", headers: { host } },
      { accessKeyId: accessKey, secretAccessKey: secretKey },
    );
    await fetch(`http://${host}/${key}`, { method: "DELETE", headers: del.headers }).catch(() => {});
  } catch (e) {
    bad++;
    console.log(`  #${i + 1} 失败：${e.message}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
console.log(`\n成功率 ${ok}/${times}，失败 ${bad}，平均 ${(totalMs / 1000 / Math.max(ok, 1)).toFixed(1)}s/次`);
