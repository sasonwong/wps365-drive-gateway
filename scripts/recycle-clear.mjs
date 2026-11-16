// 一次性脚本：清空 WPS 回收站（按 bucket 对应的 drive 逐个清）
// 用法：
//   node scripts/recycle-clear.mjs                      # 只统计，不删（默认 dry-run）
//   node scripts/recycle-clear.mjs --drive auto-backup   # 只看某个 bucket
//   node scripts/recycle-clear.mjs --drive auto-backup --yes
// 注意：clear 不可逆，清掉的回收站文件找不回来。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WpsClient } from "../src/wps.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfgPath = process.env.WPS_GATEWAY_CONFIG ?? path.join(root, "config.json");
const tokenPath = process.env.WPS_GATEWAY_TOKEN ?? path.join(root, "tokens.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const only = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--drive") only.push(args[++i]);
  else if (args[i].startsWith("--drive=")) only.push(args[i].slice(8));
}
const PAGE_CAP = 50; // 分页上限：dry-run 计数不至于被限流拖死

const wps = new WpsClient(cfg.wps, tokenPath);
await wps.ensureToken();

const targets = cfg.buckets.filter((b) => !only.length || only.includes(b.name) || only.includes(b.driveId));
// 不在 buckets 里的 driveId（如团队文档库 doclib）允许直传：--drive 71MDXzM
for (const d of only) {
  if (d && !cfg.buckets.some((b) => b.name === d || b.driveId === d)) targets.push({ name: d, driveId: d });
}
if (!targets.length) {
  console.error(`没有匹配的 bucket。可选：${cfg.buckets.map((b) => b.name).join(", ")}，或直接传 driveId`);
  process.exit(1);
}

for (const b of targets) {
  if (!yes) {
    // dry-run：分页统计（遇到限流由 request() 内部退避）
    let items = 0, bytes = 0, pages = 0, tok;
    for (;;) {
      const q = `/v7/deleted_files?page_size=100&drive_id=${encodeURIComponent(b.driveId)}${tok ? `&page_token=${encodeURIComponent(tok)}` : ""}`;
      const d = await wps.get(q);
      items += d?.items?.length ?? 0;
      bytes += (d?.items ?? []).reduce((s, i) => s + (i.size ?? 0), 0);
      tok = d?.next_page_token;
      if (!tok || ++pages >= PAGE_CAP) break;
    }
    const more = tok ? `（已达 ${PAGE_CAP} 页上限，实际更多）` : "";
    console.log(`${b.name} (${b.driveId}): ${items} 项, ${(bytes / 1048576).toFixed(1)} MB${more}`);
    continue;
  }

  // 清空：返回 task_id。drive_tasks meta 一开始报 403008078（任务行异步创建），
  // 完成后的 status 又滞后数分钟才变 success，所以先用「回收站首页为空」当完成信号。
  // 建行后又长期停在 running 0/total（实测清完仍不变）。所以只拿「回收站首页为空」当完成信号。
  const t = await wps.post("/v7/deleted_files/clear", { drive_id: b.driveId });
  const taskId = t?.task_id;
  console.log(`${b.name} (${b.driveId}): 已提交清空任务 ${taskId ?? "(无 task_id)"}，1~20 分钟量级，等待中…`);
  let last = "";
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    const d = await wps.get(`/v7/deleted_files?page_size=100&drive_id=${encodeURIComponent(b.driveId)}`);
    const n = d?.items?.length ?? 0;
    const more = d?.next_page_token ? "+（还有下一页）" : "";
    last = `首页剩 ${n} 项${more}`;
    console.log(`  第 ${((i + 1) * 15 / 60).toFixed(1)}min: ${last}`);
    if (n === 0) break;
  }
  if (!last.startsWith("首页剩 0") && taskId) {
    console.log(`  未在等待窗口内清完，可稍后查 /v7/drive_tasks/${taskId}/meta 或重跑本脚本`);
  }
}

if (!yes) console.log("\n以上为 dry-run（未删除）。确认要清空请加 --yes");
