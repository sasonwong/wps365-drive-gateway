// 抓取 WPS365 文档站 Markdown 到 docs/wps-api-docs/（一次性离线快照）
// 来源：open-docs.wpscdn.cn/docs-md（正文 md）+ open.wps.cn/docs/api/collections（目录树）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, "docs", "wps-api-docs");

// 抓取范围：yundoc 全量 + 通用基础文档（签名/错误码/调用流程）
const SCOPE_PREFIXES = ["/app-integration-dev/wps365/server/yundoc/", "/app-integration-dev/wps365/server/api-description/"];

const tree = (await (await fetch("https://open.wps.cn/docs/api/collections/wps365")).json()).data;

const files = [];
(function walk(items) {
  for (const it of items) {
    if (it.type === "file" && SCOPE_PREFIXES.some((p) => it.path.startsWith(p))) {
      files.push(it);
    }
    if (it.children) walk(it.children);
  }
})(tree.items);

console.log(`共 ${files.length} 篇文档`);

let ok = 0, fallback = 0, fail = 0;
for (const f of files) {
  const rel = f.path.replace(/^\//, "").replace(/\/$/, "");
  const outPath = path.join(OUT, rel + ".md");
  // 优先 docs-md CDN 直出
  const mdUrl = `https://open-docs.wpscdn.cn/docs-md/zh/${rel}.md`;
  const r = await fetch(mdUrl);
  let text = "";
  if (r.ok) {
    text = await r.text();
    ok++;
  } else {
    // 回退：docs/api/doc/{id} → 转纯文本
    const jr = await fetch(`https://open.wps.cn/docs/api/doc/${f.docInfo.id}?lang=zh&source=dms`);
    if (jr.ok) {
      const d = (await jr.json()).data;
      let content = d.content
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      // 参数表格里的嵌套 JSON schema → 可读形式：name: description
      content = content.replace(/\{"key":"[^"]*","name":"([^"]*)"[^}]*?"description":"([^"]*)"/g, "$1: $2");
      content = content.replace(/\\n","children":\[\]\}/g, "");
      content = content.replace(/\\n","children\":\[[^\]]*\]\}/g, "");
      text = `# ${d.fileName}\n\n${content.replace(/\n{3,}/g, "\n\n")}`;
      fallback++;
    } else {
      console.log("FAIL:", f.path);
      fail++;
      continue;
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text);
}
// 清理 api 回退产生的 JSON schema 残留（嵌套 children 结构）
for (const f of fs.readdirSync(OUT, { recursive: true }).filter((p) => p.endsWith(".md"))) {
  const p = path.join(OUT, f);
  let t = fs.readFileSync(p, "utf8");
  const orig = t;
  t = t.replace(/\{"key":"[^"]*","name":"([^"]*)"[^}]*?"description":"([^"]*)"/g, "$1: $2");
  t = t.replace(/\\n",?"children":\[[^\]]*\]\},?/g, "");
  t = t.replace(/"children":\[[^\]]*\]\},?/g, "");
  t = t.replace(/,?\]\},?/g, "");
  t = t.replace(/\n,+/g, "\n");
  if (t !== orig) fs.writeFileSync(p, t);
}
console.log(`完成: md 直出 ${ok}, api 回退 ${fallback}, 失败 ${fail}`);
