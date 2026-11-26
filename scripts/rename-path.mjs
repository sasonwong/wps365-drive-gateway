// 一次性脚本：重命名网盘里的目录/文件（走 WPS 的 rename API，不删不重建）
// 用法：
//   node scripts/rename-path.mjs <bucket> <路径> <新名字>          # 只解析，不动
//   node scripts/rename-path.mjs <bucket> <路径> <新名字> --yes    # 执行
// 例：node scripts/rename-path.mjs personal rustic/sys sys-xs2 --yes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WpsClient } from "../src/wps.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg = JSON.parse(
  fs.readFileSync(process.env.WPS_GATEWAY_CONFIG ?? path.join(root, "config.json"), "utf8"),
);
const tokenPath = process.env.WPS_GATEWAY_TOKEN ?? path.join(root, "tokens.json");

const [bucketName, fullPath, newName] = process.argv.slice(2);
const yes = process.argv.includes("--yes");
if (!bucketName || !fullPath || !newName) {
  console.error("用法: node scripts/rename-path.mjs <bucket> <路径> <新名字> [--yes]");
  process.exit(2);
}
const bucket = cfg.buckets.find((b) => b.name === bucketName);
if (!bucket) {
  console.error(`未知 bucket: ${bucketName}（可选: ${cfg.buckets.map((b) => b.name).join(", ")}）`);
  process.exit(2);
}

const wps = new WpsClient(cfg.wps, tokenPath);
await wps.ensureToken();

async function childrenAll(parentId) {
  const out = [];
  let token = "";
  do {
    const d = await wps.children(bucket.driveId, parentId, token);
    out.push(...(d.items ?? []));
    token = d.next_page_token ?? "";
    if (token) await new Promise((r) => setTimeout(r, 200));
  } while (token);
  return out;
}

const segs = fullPath.split("/").filter(Boolean);
let parentId = "0";
for (let i = 0; i < segs.length - 1; i++) {
  const hit = (await childrenAll(parentId)).find((f) => f.name === segs[i]);
  if (!hit) {
    console.error(`路径不存在: /${segs.slice(0, i + 1).join("/")}`);
    process.exit(1);
  }
  parentId = hit.id;
}
const target = (await childrenAll(parentId)).find((f) => f.name === segs.at(-1));
if (!target) {
  console.error(`路径不存在: /${fullPath}`);
  process.exit(1);
}

console.log(`找到 /${fullPath}  id=${target.id}  type=${target.type ?? "?"}  size=${target.size ?? 0}`);
if (target.name === newName) {
  console.log("名字已经是目标值，无需重命名");
  process.exit(0);
}
if (!yes) {
  console.log(`dry-run：将重命名为 "${newName}"（加 --yes 执行）`);
  process.exit(0);
}
await wps.renameFile(bucket.driveId, target.id, newName);
const after = (await childrenAll(parentId)).find((f) => f.id === target.id);
if (after?.name !== newName) {
  console.error(`重命名后核对失败：现在是 "${after?.name}"`);
  process.exit(1);
}
console.log(`✓ /${fullPath} → /${[...segs.slice(0, -1), newName].join("/")}`);
