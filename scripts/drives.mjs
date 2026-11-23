// 发现可用的盘：个人盘（allotee_type=user）+ 团队文档库，给出建议的 bucket 名。
// 用法：
//   node scripts/drives.mjs            # 表格
//   node scripts/drives.mjs --json     # 只输出未配置项的 buckets 片段，可直接粘进 config.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WpsClient } from "../src/wps.js";
import { nameFor } from "../src/buckets.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg = JSON.parse(fs.readFileSync(process.env.WPS_GATEWAY_CONFIG ?? path.join(root, "config.json"), "utf8"));
const wps = new WpsClient(cfg.wps, process.env.WPS_GATEWAY_TOKEN ?? path.join(root, "tokens.json"), {});
await wps.ensureToken();

async function all(p) {
  const out = [];
  let token = "";
  do {
    const r = await wps.get(`${p}${p.includes("?") ? "&" : "?"}page_size=100${token ? `&page_token=${encodeURIComponent(token)}` : ""}`);
    out.push(...(r.items ?? []));
    token = r.next_page_token ?? "";
  } while (token);
  return out;
}

const drives = (await all("/v7/drives?allotee_type=user")).map((d) => ({ kind: "user", id: d.id, name: d.name }));
const doclibs = (await all("/v7/doclibs")).map((d) => { const x = d.drive ?? d; return { kind: "doclib", id: x.id, name: x.name }; });
const configured = new Map(cfg.buckets.map((b) => [b.driveId, b.name]));

const rows = [...drives, ...doclibs].map((d) => ({ ...d, suggestion: nameFor(d.kind, d.id), configured: configured.get(d.id) }));
if (process.argv.includes("--json")) {
  const pending = rows.filter((r) => !r.configured).map((r) => ({ name: r.suggestion, driveId: r.id }));
  console.log(JSON.stringify(pending, null, 2));
} else {
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - [...s].reduce((w, c) => w + (c.charCodeAt(0) > 127 ? 2 : 1), 0)));
  console.log(pad("类型", 8) + pad("ID", 10) + pad("名称", 22) + "建议 bucket 名");
  for (const r of rows) {
    const kind = r.kind === "doclib" ? "文档库" : "用户盘";
    console.log(pad(kind, 8) + pad(r.id, 10) + pad(r.name ?? "", 22) + r.suggestion + (r.configured ? `   ← 已配置为 ${r.configured}` : ""));
  }
  const missing = cfg.buckets.filter((b) => !rows.some((r) => r.id === b.driveId));
  if (missing.length) console.log(`\n⚠️ 配置了但看不到：${missing.map((b) => `${b.name}(${b.driveId})`).join(", ")}`);
}
