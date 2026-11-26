// 设备码登录助手（部署新机器、手工续授权、验证会话是否存活都用它）
// 用法：
//   node scripts/login.mjs [token 文件]              # 设备码登录，默认 ./tokens.json
//   node scripts/login.mjs [token 文件] --refresh    # 用现有 refresh_token 强制刷新一次
// 例：
//   node scripts/login.mjs /tmp/session-b.json
//   node scripts/login.mjs /tmp/session-b.json --refresh
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WpsClient } from "../src/wps.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg = JSON.parse(
  fs.readFileSync(process.env.WPS_GATEWAY_CONFIG ?? path.join(root, "config.json"), "utf8"),
);
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const file = positional[0] ?? process.env.WPS_GATEWAY_TOKEN ?? path.join(root, "tokens.json");
const forceRefresh = process.argv.includes("--refresh");

const wps = new WpsClient(cfg.wps, file);
if (forceRefresh) {
  await wps.refresh();
  console.log(`✓ refresh 成功，新 access 过期 ${new Date(wps.expiresAt).toLocaleString()}`);
} else {
  await wps.login(cfg.wps.scopes);
  console.log(`✓ token 已写入 ${file}`);
}

// 用真实接口验一下，避免"拿到 token 但没权限"
const drives = await wps.listDrives();
console.log(`✓ 会话可用，用户盘 ${(drives.items ?? []).length} 个`);
