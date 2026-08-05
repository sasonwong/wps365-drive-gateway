// S3 协议层：路由 + XML 响应
import express from "express";
import { parseAuth, verifySigV4, sigV4Error } from "./sigv4.js";

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function errXml(code, msg) {
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${xmlEscape(msg)}</Message></Error>`;
}

export function createS3App({ wps, buckets, creds, readOnly, tokenFile }) {
  const app = express();
  app.disable("x-powered-by");

  // ── 请求预处理：收集 body + SigV4 验证 ─────────────────────────
  app.use((req, res, next) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      req.rawBody = Buffer.concat(chunks);
      if (!verifySigV4(req, creds)) {
        res.status(403).type("xml").send(sigV4Error().xml);
        return;
      }
      next();
    });
    req.on("error", () => res.status(400).end());
  });

  const bucket = (name) => buckets.find((b) => b.name === name);

  // ── ListBuckets: GET / ────────────────────────────────────────
  app.get("/", async (req, res) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner><ID>wps365</ID></Owner>
  <Buckets>${buckets.map((b) => `<Bucket><Name>${xmlEscape(b.name)}</Name></Bucket>`).join("")}</Buckets>
</ListAllMyBucketsResult>`;
    res.type("xml").send(xml);
  });

  // ── ListObjectsV2: GET /{bucket}?list-type=2 ──────────────────
  app.get("/:bucket", async (req, res, next) => {
    try {
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "The specified bucket does not exist"));
      const prefix = req.query.prefix ?? "";
      const delimiter = req.query.delimiter;
      const contToken = req.query["continuation-token"] ?? "";
      const maxKeys = Math.min(parseInt(req.query["max-keys"] ?? "1000", 10) || 1000, 5000);

      // 拉取目录树：prefix 按 "/" 逐级下钻，其余条目由网关按前缀过滤
      const { items, nextToken } = await listTree(wps, b.driveId, prefix, delimiter, maxKeys, contToken);

      const contents = items
        .filter((f) => f.key.startsWith(prefix) && !f.isCommonPrefix)
        .map((f) => `<Contents>
  <Key>${xmlEscape(f.key)}</Key>
  <Size>${f.size ?? 0}</Size>
  <LastModified>${new Date((f.mtime ?? 0) * 1000).toISOString()}</LastModified>
  <ETag>"${f.etag ?? ""}"</ETag>
  <StorageClass>STANDARD</StorageClass>
</Contents>`).join("");
      const commonPrefixes = items
        .filter((f) => f.isCommonPrefix)
        .map((f) => `<CommonPrefixes><Prefix>${xmlEscape(f.key)}</Prefix></CommonPrefixes>`).join("");

      const truncated = nextToken ? "true" : "false";
      res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${xmlEscape(b.name)}</Name>
  <Prefix>${xmlEscape(prefix)}</Prefix>
  ${delimiter ? `<Delimiter>${xmlEscape(delimiter)}</Delimiter>` : ""}
  <KeyCount>${items.length}</KeyCount>
  <MaxKeys>${maxKeys}</MaxKeys>
  <IsTruncated>${truncated}</IsTruncated>
  ${nextToken ? `<NextContinuationToken>${xmlEscape(nextToken)}</NextContinuationToken>` : ""}
  ${contents}${commonPrefixes}
</ListBucketResult>`);
    } catch (e) { next(e); }
  });

  // ── GetObject / HeadObject: GET|HEAD /{bucket}/{key} ──────────
  const handleGet = async (req, res) => {
    const b = bucket(req.params.bucket);
    if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
    const file = await resolvePath(wps, b.driveId, req.params[0].split("/").filter(Boolean));
    if (!file) return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified key does not exist."));
    const meta = await wps.meta(b.driveId, file.id);
    if (req.method === "HEAD") {
      res.set({ "Content-Length": meta.size ?? 0, "ETag": `"${meta.hash?.sum ?? ""}"`, "Last-Modified": new Date((meta.mtime ?? 0) * 1000).toUTCString(), "Content-Type": "application/octet-stream" });
      return res.end();
    }
    const url = await wps.downloadUrl(b.driveId, file.id);
    // 302 到 WPS 临时下载地址，客户端跟随
    res.redirect(url);
  };
  app.get("/:bucket/*", handleGet);
  app.head("/:bucket/*", handleGet);

  // ── PutObject: PUT /{bucket}/{key} ────────────────────────────
  app.put("/:bucket/*", async (req, res, next) => {
    try {
      if (readOnly) return res.status(403).type("xml").send(errXml("AccessDenied", "gateway is read-only"));
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
      const parts = req.params[0].split("/").filter(Boolean);
      const name = parts.pop();
      const parent = await ensureDirPath(wps, b.driveId, parts);
      if (!parent) return res.status(404).type("xml").send(errXml("NoSuchKey", "parent directory not found"));

      const { upload_id, store_request } = await wps.requestUpload(b.driveId, parent.id, name, req.rawBody);
      await wps.uploadStore(store_request, req.rawBody);
      await wps.commitUpload(b.driveId, parent.id, upload_id);
      res.status(200).set("ETag", `"${upload_id}"`).end();
    } catch (e) { next(e); }
  });

  // ── DeleteObject: DELETE /{bucket}/{key} ──────────────────────
  app.delete("/:bucket/*", async (req, res, next) => {
    try {
      if (readOnly) return res.status(403).type("xml").send(errXml("AccessDenied", "gateway is read-only"));
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
      const parts = req.params[0].split("/").filter(Boolean);
      const file = await resolvePath(wps, b.driveId, parts);
      if (!file) return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified key does not exist."));
      await wps.deleteFile(b.driveId, file.id);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // ── 错误处理 ──────────────────────────────────────────────────
  app.use((err, req, res, _next) => {
    console.error("[gateway]", err.message);
    res.status(500).type("xml").send(errXml("InternalError", err.message));
  });

  return app;
}

// ── 工具：路径解析与目录树列举 ──────────────────────────────────
// 路径 → 文件节点（逐级 children 查询，带 TTL 缓存）
const dirCache = new Map(); // key: driveId/parentId → {name: {id, type, size, mtime, hash}, ts}
const CACHE_TTL = 30_000;

async function childrenMap(wps, driveId, parentId) {
  const ck = `${driveId}/${parentId}`;
  const hit = dirCache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.map;
  let items = [], token = "";
  do {
    const d = await wps.children(driveId, parentId);
    items = items.concat(d.items ?? []);
    token = d.next_page_token ?? "";
    if (token) await new Promise((r) => setTimeout(r, 200));
  } while (token && items.length < 5000);
  const map = new Map(items.map((f) => [f.name, f]));
  dirCache.set(ck, { map, ts: Date.now() });
  return map;
}

async function resolveNode(wps, driveId, parts) {
  let parent = { id: "0", type: "folder" };
  for (const part of parts) {
    const map = await childrenMap(wps, driveId, parent.id);
    const node = map.get(part);
    if (!node) return null;
    parent = node;
  }
  return parent;
}

async function resolvePath(wps, driveId, parts) {
  if (parts.length === 0) return null;
  return resolveNode(wps, driveId, parts);
}

async function ensureDirPath(wps, driveId, parts) {
  if (parts.length === 0) return { id: "0" };
  let parent = { id: "0", type: "folder" };
  for (const part of parts) {
    const map = await childrenMap(wps, driveId, parent.id);
    let node = map.get(part);
    if (!node) {
      node = await wps.createFolder(driveId, parent.id, part);
      dirCache.delete(`${driveId}/${parent.id}`);
    }
    parent = node;
  }
  return parent;
}

// 列举：迭代式 DFS + continuation-token 分页（S3 语义）
// prefix 前缀过滤 + delimiter 分组；最多返回 maxKeys 条，截断时给 nextToken
async function listTree(wps, driveId, prefix, delimiter, maxKeys, contToken) {
  const items = [];
  // 栈：待枚举的目录 { dirKey, wpsToken }；contToken 恢复时从栈继续
  let stack = [];
  if (contToken) {
    try { stack = JSON.parse(Buffer.from(contToken, "base64url").toString()); } catch { /* 非法 token 从头开始 */ }
  }
  if (stack.length === 0) {
    const slash = prefix.lastIndexOf("/");
    stack.push({ dirKey: slash >= 0 ? prefix.slice(0, slash + 1) : "", wpsToken: "" });
  }

  let truncated = false;
  while (stack.length > 0 && items.length < maxKeys) {
    const cur = stack.pop();
    const parts = cur.dirKey ? cur.dirKey.split("/").filter(Boolean) : [];
    const base = await resolveNode(wps, driveId, parts);
    if (!base) continue;
    const d = await wps.children(driveId, base.id, cur.wpsToken);

    for (const f of d.items ?? []) {
      if (items.length >= maxKeys) { truncated = true; break; }
      const name = f.name ?? "";
      const key = cur.dirKey + name;
      if (!key.startsWith(prefix)) continue;
      if (f.type === "folder") {
        if (delimiter) {
          items.push({ key: key + "/", isCommonPrefix: true });
        } else if (!truncated) {
          stack.push({ dirKey: key + "/", wpsToken: "" });
        }
      } else {
        items.push({ key, size: f.size, mtime: f.mtime, etag: f.hash?.sum, isCommonPrefix: false });
      }
    }
    // 本目录还有下一页 → 放回栈（子目录已入栈，DFS 顺序略乱但正确）
    if (!truncated && d.next_page_token) stack.push({ dirKey: cur.dirKey, wpsToken: d.next_page_token });
  }
  if (stack.length > 0) truncated = true;
  const nextToken = truncated
    ? Buffer.from(JSON.stringify(stack.slice(0, 50))).toString("base64url")
    : "";
  return { items, nextToken };
}
