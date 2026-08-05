// S3 协议层：路由 + XML 响应
import express from "express";
import crypto from "node:crypto";
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
  app.get("/", async (req, res) => {    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner><ID>wps365</ID></Owner>
  <Buckets>${buckets.map((b) => `<Bucket><Name>${xmlEscape(b.name)}</Name></Bucket>`).join("")}</Buckets>
</ListAllMyBucketsResult>`;
    res.type("xml").send(xml);
  });

  // ── HeadBucket: HEAD /{bucket}（rclone/aws cli 检查 bucket 存在性）──
  app.head("/:bucket", (req, res) => {
    const b = bucket(req.params.bucket);
    if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "The specified bucket does not exist"));
    res.status(200).end();
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
    // S3 语义：目录 key 不是对象，GET/HEAD 应 404（rclone 靠 HEAD 区分文件/目录）
    if (file.type === "folder") return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified key does not exist."));
    const meta = await wps.meta(b.driveId, file.id);
    if (req.method === "HEAD") {
      res.set({ "Content-Length": meta.size ?? 0, "ETag": `"${meta.hash?.sum ?? ""}"`, "Last-Modified": new Date((meta.mtime ?? 0) * 1000).toUTCString(), "Content-Type": "application/octet-stream" });
      return res.end();
    }
    // 网关内部代理下载：存储网关要求 Bearer（客户端跟随 302 会丢凭据）
    const url = await wps.downloadUrl(b.driveId, file.id);
    const headers = { Authorization: `Bearer ${wps.accessToken}` };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(url, { headers, redirect: "follow" });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).type("xml").send(errXml("InternalError", `download failed: ${upstream.status}`));
    }
    res.status(upstream.status);
    const lmFallback = new Date((meta.mtime ?? 0) * 1000).toUTCString();
    for (const h of ["content-range", "accept-ranges", "content-length", "etag", "last-modified", "content-type"]) {
      const v = upstream.headers.get(h);
      if (v) res.set(h, h === "last-modified" ? v : v);
    }
    if (!res.get("Last-Modified")) res.set("Last-Modified", lmFallback);
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body).pipe(res);
  };
  app.get("/:bucket/*", handleGet);
  app.head("/:bucket/*", handleGet);

  // ── Multipart upload 状态（缓冲式：Complete 时统一建 WPS 任务）──
  // ponytail: 内存缓冲，单文件过大（>2GB）会吃紧；需要时改 spool 磁盘
  const mpu = new Map(); // uploadId → { b, parts: Map<number,Buffer>, name, key }

  // CreateMultipartUpload: POST /{bucket}/{key}?uploads
  // CompleteMultipartUpload: POST /{bucket}/{key}?uploadId=...
  app.post("/:bucket/*", async (req, res, next) => {
    try {
      if (readOnly) return res.status(403).type("xml").send(errXml("AccessDenied", "gateway is read-only"));
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
      const parts = req.params[0].split("/").filter(Boolean);
      const name = parts.pop();
      if (req.query.uploads !== undefined) { // Create
        const uploadId = crypto.randomUUID();
        mpu.set(uploadId, { b, parts, name, chunks: new Map() });
        return res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>${xmlEscape(b.name)}</Bucket>
  <Key>${xmlEscape(req.params[0])}</Key>
  <UploadId>${uploadId}</UploadId>
</InitiateMultipartUploadResult>`);
      }
      if (req.query.uploadId) { // Complete：拼接全部 part → 建 WPS 任务 → 按 WPS 块大小上传
        const up = mpu.get(req.query.uploadId);
        if (!up) return res.status(404).type("xml").send(errXml("NoSuchUpload", "The specified upload does not exist."));
        const parent = await ensureDirPath(wps, b.driveId, up.parts);
        const body = Buffer.concat([...up.chunks.values()]);
        const sha256 = crypto.createHash("sha256").update(body).digest("hex");
        const task = await wps.multipartCreate(b.driveId, parent.id, up.name, body.length, sha256);
        // 按 WPS 固定块大小重新切块上传（S3 客户端块大小不受控）
        for (let i = 0; i < task.part_count; i++) {
          const chunk = body.subarray(i * task.part_size, (i + 1) * task.part_size);
          await wps.multipartPutPart(task.upload_addr, i + 1, chunk);
        }
        await wps.multipartCommit(task.upload_id);
        mpu.delete(req.query.uploadId);
        invalidateDir(b.driveId, parent.id);
        return res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Location>${xmlEscape(b.name)}</Location>
  <Bucket>${xmlEscape(b.name)}</Bucket>
  <Key>${xmlEscape(req.params[0])}</Key>
  <ETag>"${sha256}"</ETag>
</CompleteMultipartUploadResult>`);
      }
      next();
    } catch (e) { next(e); }
  });

  // ── PutBucket: PUT /{bucket}（rclone copyto 等会尝试创建；固定映射视为已存在）──
  app.put("/:bucket", (req, res) => {
    const b = bucket(req.params.bucket);
    if (!b) return res.status(403).type("xml").send(errXml("AccessDenied", "bucket creation not supported"));
    res.status(200).end();
  });

  // ── DeleteObjects: POST /{bucket}?delete（批量删除，映射 batch_delete）──
  app.post("/:bucket", async (req, res, next) => {
    try {
      if (readOnly) return res.status(403).type("xml").send(errXml("AccessDenied", "gateway is read-only"));
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
      if (req.query.delete === undefined) return next();
      // 解析 XML body：<Delete><Object><Key>..</Key></Object>...<Quiet>..</Quiet></Delete>
      const xml = req.rawBody.toString();
      const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) =>
        m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'"));
      const quiet = /<Quiet>\s*true\s*<\/Quiet>/.test(xml);
      if (keys.length === 0) return res.status(400).type("xml").send(errXml("MalformedXML", "no keys"));

      // 逐个解析 key → file_id（路径解析走目录缓存，代价小）
      const deleted = [], errors = [];
      const batch = []; // { driveId, fileId, key }
      for (const key of keys) {
        const file = await resolvePath(wps, b.driveId, key.split("/").filter(Boolean));
        if (!file) errors.push(`  <Error><Key>${xmlEscape(key)}</Key><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`);
        else batch.push({ driveId: b.driveId, fileId: file.id, key });
      }
      // 一次 batch_delete 全删（文件夹也支持）；分 200 一批
      for (let i = 0; i < batch.length; i += 200) {
        const chunk = batch.slice(i, i + 200);
        const t = await wps.post(`/v7/drives/${b.driveId}/files/batch_delete`, { file_ids: chunk.map((c) => c.fileId) });
        for (let n = 0; n < 60; n++) {
          await new Promise((r) => setTimeout(r, 2000));
          const m = await wps.taskMeta(t.task_id);
          if (m.failed > 0) {
            errors.push(`  <Error><Key>${xmlEscape(chunk[0].key)}</Key><Code>InternalError</Code><Message>batch delete task failed</Message></Error>`);
            break;
          }
          if (m.status === "success") break;
        }
      }
      if (!quiet) for (const c of batch) deleted.push(`  <Deleted><Key>${xmlEscape(c.key)}</Key></Deleted>`);
      // 失效涉及目录缓存
      for (const c of batch) {
        const parentParts = c.key.split("/").filter(Boolean).slice(0, -1);
        const parent = parentParts.length ? await resolveNode(wps, b.driveId, parentParts) : { id: "0" };
        invalidateDir(b.driveId, parent.id);
      }
      res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n${deleted.join("\n")}${errors.join("\n")}\n</DeleteResult>`);
    } catch (e) { next(e); }
  });

  // ── PutObject / CopyObject / UploadPart: PUT /{bucket}/{key} ──
  app.put("/:bucket/*", async (req, res, next) => {
    try {
      if (readOnly) return res.status(403).type("xml").send(errXml("AccessDenied", "gateway is read-only"));
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
      const parts = req.params[0].split("/").filter(Boolean);

      // UploadPart: 缓冲到 uploadId 对应会话（Complete 时统一上传）
      if (req.query.uploadId && req.query.partNumber) {
        const up = mpu.get(req.query.uploadId);
        if (!up) return res.status(404).type("xml").send(errXml("NoSuchUpload", "The specified upload does not exist."));
        up.chunks.set(parseInt(req.query.partNumber, 10), Buffer.from(req.rawBody));
        return res.status(200).set("ETag", `"${crypto.createHash("md5").update(req.rawBody).digest("hex")}"`).end();
      }

      // CopyObject: x-amz-copy-source=/srcbucket/srckey
      if (req.headers["x-amz-copy-source"]) {
        const src = decodeURIComponent(req.headers["x-amz-copy-source"]).replace(/^\//, "");
        const slash = src.indexOf("/");
        const srcBucket = src.slice(0, slash);
        const srcKey = src.slice(slash + 1);
        const sb = bucket(srcBucket);
        if (!sb) return res.status(404).type("xml").send(errXml("NoSuchBucket", "source bucket not found"));
        const srcFile = await resolvePath(wps, sb.driveId, srcKey.split("/").filter(Boolean));
        if (!srcFile) return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified source key does not exist."));
        const name = parts.pop();
        const parent = await ensureDirPath(wps, b.driveId, parts);
        const dstFileId = await wps.copyFile(sb.driveId, srcFile.id, b.driveId, parent.id);
        if (dstFileId && name !== srcFile.name) {
          await wps.renameFile(b.driveId, dstFileId, name);
        }
        invalidateDir(b.driveId, parent.id);
        // S3 规范要求 CopyObjectResult XML 响应体（rclone 等客户端会反序列化）
        const lm = new Date((srcFile.mtime ?? Date.now() / 1000) * 1000).toISOString();
        return res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><ETag>"${srcFile.hash?.sum ?? ""}"</ETag><LastModified>${lm}</LastModified></CopyObjectResult>`);
      }

      // 普通 PUT（整块上传）
      const name = parts.pop();
      const parent = await ensureDirPath(wps, b.driveId, parts);
      if (!parent) return res.status(404).type("xml").send(errXml("NoSuchKey", "parent directory not found"));

      const { upload_id, store_request } = await wps.requestUpload(b.driveId, parent.id, name, req.rawBody);
      await wps.uploadStore(store_request, req.rawBody);
      await wps.commitUpload(b.driveId, parent.id, upload_id);
      invalidateDir(b.driveId, parent.id);
      res.status(200).set("ETag", `"${upload_id}"`).end();
    } catch (e) { next(e); }
  });

  // ── DeleteObject / AbortMultipartUpload: DELETE /{bucket}/{key} ──
  app.delete("/:bucket/*", async (req, res, next) => {
    try {
      if (readOnly) return res.status(403).type("xml").send(errXml("AccessDenied", "gateway is read-only"));
      const b = bucket(req.params.bucket);
      if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
      if (req.query.uploadId) { // Abort
        const up = mpu.get(req.query.uploadId);
        if (!up) return res.status(404).type("xml").send(errXml("NoSuchUpload", "The specified upload does not exist."));
        mpu.delete(req.query.uploadId);
        return res.status(204).end();
      }
      const parts = req.params[0].split("/").filter(Boolean);
      const file = await resolvePath(wps, b.driveId, parts);
      if (!file) return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified key does not exist."));
      if (file.type === "folder") {
        // delete_file 不支持文件夹，文件夹必须走 batch_delete（异步）
        const t = await wps.post(`/v7/drives/${b.driveId}/files/batch_delete`, { file_ids: [file.id] });
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const m = await wps.taskMeta(t.task_id);
          if (m.status === "success") break;
          if (m.failed > 0) throw new Error(`delete folder task failed: ${t.task_id}`);
        }
      } else {
        await wps.deleteFile(b.driveId, file.id);
      }
      // 失效文件所在目录缓存（父目录 = 去掉最后一层的 parts）
      const parentParts = parts.slice(0, -1);
      const parent = parentParts.length ? await resolveNode(wps, b.driveId, parentParts) : { id: "0" };
      invalidateDir(b.driveId, parent.id);
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

// 写入操作后失效父目录缓存（PUT/DELETE/Copy/Complete 都会改变目录内容）
function invalidateDir(driveId, parentId) {
  dirCache.delete(`${driveId}/${parentId}`);
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
