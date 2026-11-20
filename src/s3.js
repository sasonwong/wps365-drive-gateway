// S3 协议层：路由 + XML 响应
import express from "express";
import crypto from "node:crypto";
import { parseAuth, verifySigV4, sigV4Error } from "./sigv4.js";
import { throttleStream } from "./throttle.js";

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function errXml(code, msg) {
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${xmlEscape(msg)}</Message></Error>`;
}

export function createS3App({ wps, buckets, creds, readOnly, pruneEmptyDirs = true, cacheTtlMs = 30_000, listConcurrency = 16, uploadConcurrency = 2 }) {
  CACHE_TTL = cacheTtlMs;
  LIST_CONCURRENCY = Math.max(1, listConcurrency);
  INGRESS_CONCURRENCY = Math.max(1, uploadConcurrency);
  const app = express();
  app.disable("x-powered-by");

  // ── 请求预处理：收集 body + SigV4 验证 ─────────────────────────
  // 写请求先过入口闸门：整个 body 会驻留内存（峰值是对象的数倍），
  // 不限并发就会叠乘。闸门必须卡在「读 body 之前」，卡在 WPS 上传那一步没用。
  app.use(async (req, res, next) => {
    const gated = req.method === "PUT" || req.method === "POST";
    if (gated) await acquireIngress();
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
    if (gated) {
      let released = false;
      const release = () => { if (!released) { released = true; releaseIngress(); } };
      res.on("finish", release);
      res.on("close", release); // 客户端中断也要还名额
    }
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
      // ListMultipartUploads：上传会话只活在内存里（重启即失），统一返回空列表
      if (req.query.uploads !== undefined) {
        return res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<ListMultipartUploadsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>${xmlEscape(b.name)}</Bucket>
  <KeyMarker>${xmlEscape(req.query["key-marker"] ?? "")}</KeyMarker>
  <UploadIdMarker>${xmlEscape(req.query["upload-id-marker"] ?? "")}</UploadIdMarker>
  <MaxUploads>${Math.min(parseInt(req.query["max-uploads"] ?? "1000", 10) || 1000, 1000)}</MaxUploads>
  <IsTruncated>false</IsTruncated>
</ListMultipartUploadsResult>`);
      }
      // GetBucketLocation：bucket 是固定映射，无真实区域，回 us-east-1
      if (req.query.location !== undefined) {
        return res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-east-1</LocationConstraint>`);
      }
      const isV2 = req.query["list-type"] === "2";
      const prefix = req.query.prefix ?? "";
      const delimiter = req.query.delimiter;
      // V2 用 continuation-token；V1 用 marker（可能是网关上次发的 NextMarker token，也可能是普通 key）
      const contToken = isV2 ? (req.query["continuation-token"] ?? "") : "";
      const marker = isV2 ? "" : (req.query.marker ?? "");
      const maxKeys = Math.min(parseInt(req.query["max-keys"] ?? "1000", 10) || 1000, 5000);

      // 拉取目录树：prefix 按 "/" 逐级下钻，其余条目由网关按前缀过滤
      const { items, nextToken } = await listTree(wps, b.driveId, prefix, delimiter, maxKeys, contToken, marker);

      const contents = items
        .filter((f) => f.key.startsWith(prefix) && !f.isCommonPrefix)
        .map((f) => `<Contents>
  <Key>${xmlEscape(f.key)}</Key>
  <Size>${f.size ?? 0}</Size>
  <LastModified>${new Date((f.mtime || 0) * 1000).toISOString()}</LastModified>
  <ETag>"${f.etag ?? ""}"</ETag>
  <StorageClass>STANDARD</StorageClass>
</Contents>`).join("");
      const commonPrefixes = items
        .filter((f) => f.isCommonPrefix)
        .map((f) => `<CommonPrefixes><Prefix>${xmlEscape(f.key)}</Prefix></CommonPrefixes>`).join("");

      const truncated = nextToken ? "true" : "false";
      // V1/V2 分页字段：V2 用 ContinuationToken/NextContinuationToken + KeyCount；
      // V1（s3cmd 等）用 Marker/NextMarker——NextMarker 复用内部 token，客户端原样传回即可续页
      const pagination = isV2
        ? `${req.query["continuation-token"] ? `<ContinuationToken>${xmlEscape(req.query["continuation-token"])}</ContinuationToken>` : ""}
  <KeyCount>${items.length}</KeyCount>
  ${nextToken ? `<NextContinuationToken>${xmlEscape(nextToken)}</NextContinuationToken>` : ""}`
        : `<Marker>${xmlEscape(marker)}</Marker>
  ${nextToken ? `<NextMarker>${xmlEscape(nextToken)}</NextMarker>` : ""}`;
      res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${xmlEscape(b.name)}</Name>
  <Prefix>${xmlEscape(prefix)}</Prefix>
  ${pagination}
  ${delimiter ? `<Delimiter>${xmlEscape(delimiter)}</Delimiter>` : ""}
  <MaxKeys>${maxKeys}</MaxKeys>
  <IsTruncated>${truncated}</IsTruncated>
  ${contents}${commonPrefixes}
</ListBucketResult>`);
    } catch (e) { next(e); }
  });

  // ── GetObject / HeadObject: GET|HEAD /{bucket}/{key} ──────────
  const handleGet = async (req, res, next) => {
    try {
    const b = bucket(req.params.bucket);
    if (!b) return res.status(404).type("xml").send(errXml("NoSuchBucket", "bucket not found"));
    let file = await resolvePath(wps, b.driveId, req.params[0].split("/").filter(Boolean));
    // 近期上传过的 key：WPS children 最终一致延迟，延迟后重查一次
    if (!file) {
      const rk = `${b.driveId}/${req.params[0]}`;
      if (recentUploads.has(rk) && Date.now() - recentUploads.get(rk) < 60_000) {
        const parentParts = req.params[0].split("/").filter(Boolean).slice(0, -1);
        if (parentParts.length) {
          const parent = await resolveNode(wps, b.driveId, parentParts);
          if (parent) invalidateDir(b.driveId, parent.id);
        }
        await new Promise((r) => setTimeout(r, 700));
        file = await resolvePath(wps, b.driveId, req.params[0].split("/").filter(Boolean));
        if (file) recentUploads.delete(rk);
      }
    }
    if (!file) return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified key does not exist."));
    // rclone 判定：HEAD 无尾斜杠 200=文件 / 404=目录（NewFs）；
    // HEAD 带尾斜杠（directory marker，MinIO 兼容）= 200 + application/directory（Update 验证）
    if (file.type === "folder") {
      if (req.params[0].endsWith("/")) {
        res.set({ "Content-Type": "application/directory", "Content-Length": 0, "ETag": `"${file.id}"` });
        return res.status(200).end();
      }
      return res.status(404).type("xml").send(errXml("NoSuchKey", "The specified key does not exist."));
    }
    const meta = await wps.meta(b.driveId, file.id);
    const mtime = meta.mtime || 0;
    if (req.method === "HEAD") {
      // WPS 原生 mtime（秒级）即 S3 Last-Modified；rclone 增量对比走 size_only，不依赖 mtime
      const headers = { "Content-Length": meta.size ?? 0, "ETag": `"${meta.hash?.sum ?? ""}"`, "Last-Modified": new Date(mtime * 1000).toUTCString(), "Content-Type": "application/octet-stream" };
      res.set(headers);
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
    const lmFallback = new Date((meta.mtime || 0) * 1000).toUTCString();
    for (const h of ["content-range", "accept-ranges", "content-length", "etag", "last-modified", "content-type"]) {
      const v = upstream.headers.get(h);
      if (v) res.set(h, h === "last-modified" ? v : v);
    }
    if (!res.get("Last-Modified")) res.set("Last-Modified", lmFallback);
    const { Readable, pipeline } = await import("node:stream");
    // 下载限速：节流下游写入，背压会一路传回 WPS 的读取。
    // 必须用 pipeline：客户端中途断开或 WPS 传一半 ECONNRESET 时，pipe 不会处理 source 的
    // error，异常会以未捕获 promise 的形式把整个进程打挂（曾因此把进程打挂）。
    const down = Readable.fromWeb(upstream.body);
    const out = wps.downloadBucket ? down.pipe(throttleStream(wps.downloadBucket)) : down;
    pipeline(out, res, (err) => {
      if (err) console.warn("[gateway] 下载中断:", err.message);
    });
    } catch (e) { next(e); }
  };
  // ListParts: GET /{bucket}/{key}?uploadId=...（rclone 断点续传 / aws s3api list-parts 调试）
  app.get("/:bucket/*", async (req, res, next) => {
    if (req.query.uploadId === undefined) return next();
    const up = mpu.get(req.query.uploadId);
    if (!up) return res.status(404).type("xml").send(errXml("NoSuchUpload", "The specified upload does not exist."));
    const parts = [...up.chunks.entries()]
      .map(([n, buf]) => `<Part><PartNumber>${n}</PartNumber><ETag>"${up.etags.get(n) ?? ""}"</ETag><Size>${buf.length}</Size></Part>`)
      .join("");
    res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Bucket>${xmlEscape(up.b.name)}</Bucket>
  <Key>${xmlEscape(up.key)}</Key>
  <UploadId>${xmlEscape(req.query.uploadId)}</UploadId>
  <PartNumberMarker>0</PartNumberMarker>
  <NextPartNumberMarker>0</NextPartNumberMarker>
  <MaxParts>${Math.min(parseInt(req.query["max-parts"] ?? "1000", 10) || 1000, 1000)}</MaxParts>
  <IsTruncated>false</IsTruncated>
  ${parts}
</ListPartsResult>`);
  });
  app.get("/:bucket/*", handleGet);
  app.head("/:bucket/*", handleGet);

  // ── Multipart upload 状态（缓冲式：Complete 时统一建 WPS 任务）──
  // ponytail: 内存缓冲，单文件过大（>2GB）会吃紧；需要时改 spool 磁盘
  const mpu = new Map(); // uploadId → { b, parts, name, key, chunks: Map<number,Buffer>, etags: Map<number,md5> }

  // 近期上传记录：HEAD 404 时延迟重查，消除 WPS children 最终一致窗口
  const recentUploads = new Map(); // `${driveId}/${key}` → ts
  const markUploaded = (b, key) => recentUploads.set(`${b.driveId}/${key}`, Date.now());

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
        mpu.set(uploadId, { b, parts, name, key: req.params[0], chunks: new Map(), etags: new Map() });
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
        const commit = await wps.multipartCommit(task.upload_id);
        mpu.delete(req.query.uploadId);
        // 注入缓存（同 PUT：HEAD 验证不依赖 WPS list 延迟）
        seedCache(wps, b.driveId, parent.id, commit ?? { id: "", name: up.name, size: body.length, type: "file" });
        markUploaded(b, req.params[0]);
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
      // 失效涉及目录缓存（无条件：删除改变了目录内容）+ 清理变空目录（可配置）
      for (const c of batch) {
        const parentParts = c.key.split("/").filter(Boolean).slice(0, -1);
        if (parentParts.length) {
          const parent = await resolveNode(wps, b.driveId, parentParts);
          if (parent) invalidateDir(b.driveId, parent.id);
        } else {
          invalidateDir(b.driveId, "0");
        }
      }
      if (pruneEmptyDirs) {
        const pruned = new Set();
        for (const c of batch) {
          const parentParts = c.key.split("/").filter(Boolean).slice(0, -1);
          const pk = parentParts.join("/");
          if (!pruned.has(pk)) {
            pruned.add(pk);
            await pruneEmptyFolders(wps, b.driveId, parentParts);
          }
        }
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
        const partNum = parseInt(req.query.partNumber, 10);
        const md5 = crypto.createHash("md5").update(req.rawBody).digest("hex");
        up.chunks.set(partNum, Buffer.from(req.rawBody));
        up.etags.set(partNum, md5);
        return res.status(200).set("ETag", `"${md5}"`).end();
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
        markUploaded(b, req.params[0]);
        // S3 规范要求 CopyObjectResult XML 响应体（rclone 等客户端会反序列化）
        const lm = new Date((srcFile.mtime ?? Date.now() / 1000) * 1000).toISOString();
        return res.type("xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><ETag>"${srcFile.hash?.sum ?? ""}"</ETag><LastModified>${lm}</LastModified></CopyObjectResult>`);
      }

      // 普通 PUT（整块上传）
      const rawKey = req.params[0];
      // S3 directory marker：PUT 尾斜杠 key = 创建文件夹（rclone directory_markers / MinIO 语义）
      if (rawKey.endsWith("/")) {
        const name = parts.pop();
        const parent = await ensureDirPath(wps, b.driveId, parts);
        if (!parent) return res.status(404).type("xml").send(errXml("NoSuchKey", "parent directory not found"));
        // 幂等：目录已存在则直接 200（createFolder 的 rename 会生成 (N) 目录）
        const map = await childrenMap(wps, b.driveId, parent.id);
        const node = map.get(name)?.type === "folder" ? { id: map.get(name).id } : await wps.createFolder(b.driveId, parent.id, name);
        invalidateDir(b.driveId, parent.id);
        return res.status(200).set("ETag", `"${node.id}"`).end();
      }
      const name = parts.pop();
      if (name.startsWith(".")) {
        return res.status(400).type("xml").send(errXml("InvalidArgument", `WPS 云盘不支持点号开头的文件名: ${name}`));
      }
      const parent = await ensureDirPath(wps, b.driveId, parts);
      if (!parent) return res.status(404).type("xml").send(errXml("NoSuchKey", "parent directory not found"));

      const { upload_id, store_request } = await wps.requestUpload(b.driveId, parent.id, name, req.rawBody);
      await wps.uploadStore(store_request, req.rawBody);
      const commit = await wps.commitUpload(b.driveId, parent.id, upload_id);
      // 注入缓存：WPS children 最终一致延迟（并发写时明显），HEAD 验证靠缓存立即可见
      seedCache(wps, b.driveId, parent.id, commit ?? { id: upload_id, name, size: req.rawBody.length, type: "file" });
      markUploaded(b, req.params[0]);
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
      // 无条件失效父目录缓存（删除改变目录内容；含删除目录本身的情形）
      const parentParts = parts.slice(0, -1);
      if (parentParts.length) {
        const parent = await resolveNode(wps, b.driveId, parentParts);
        if (parent) invalidateDir(b.driveId, parent.id);
      } else {
        invalidateDir(b.driveId, "0");
      }
      // 清理变空目录（可配置关闭）
      if (pruneEmptyDirs) await pruneEmptyFolders(wps, b.driveId, parentParts);
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
// 可调项：由 createS3App 注入（cacheTtlMs / listConcurrency）
let CACHE_TTL = 30_000;
let LIST_CONCURRENCY = 16;
let INGRESS_CONCURRENCY = 2;

// 入口闸门：限制「同时在内存里的请求体」数量
let ingressActive = 0;
const ingressWaiting = [];
function acquireIngress() {
  if (ingressActive < INGRESS_CONCURRENCY) { ingressActive++; return Promise.resolve(); }
  return new Promise((res) => ingressWaiting.push(res));
}
function releaseIngress() {
  ingressActive--;
  const next = ingressWaiting.shift();
  if (next) next();
}

// 并发闸门：列举时装取多个子目录。WPS children 单次在百毫秒级，串行 256 个目录要数十秒；
// 并发 16：256 个目录在数秒内拉完，同时给限流（429000001）留余量。
let inflight = 0;
const waiting = [];
function limited(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      inflight++;
      fn().then(resolve, reject).finally(() => {
        inflight--;
        waiting.shift()?.();
      });
    };
    if (inflight < LIST_CONCURRENCY) run(); else waiting.push(run);
  });
}

// 预取：把一个目录整页拉完并写进 dirCache。弹栈时 childrenAll 直接命中缓存，
// 于是 256 个兄弟目录是并发拉取的（并发数受 LIST_CONCURRENCY 限制），不是串行。
function prefetchAll(wps, driveId, parentId) {
  childrenAll(wps, driveId, parentId).catch(() => {}); // 失败留给后续 await 抛出
}

// 拉一个目录的**全部**条目（翻完所有页），按 name 排序后缓存。
// 排序是为了让列举可以「按名字续页」：WPS 返回顺序不保证稳定，用下标续页会错位。
const DIR_PAGE_CAP = 20; // 20 页 × 500 条，防止服务端一直返回 next_page_token 造成死循环

async function childrenAll(wps, driveId, parentId) {
  const ck = `${driveId}/${parentId}`;
  const hit = dirCache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_TTL && hit.arr) return hit.arr;
  const items = [];
  let token = "", pages = 0;
  do {
    const d = await limited(() => wps.children(driveId, parentId, token));
    items.push(...(d.items ?? []));
    token = d.next_page_token ?? "";
    if (token) await new Promise((r) => setTimeout(r, 200));
  } while (token && ++pages < DIR_PAGE_CAP);
  items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); // 名字升序 = S3 的 key 序
  const map = new Map(items.map((f) => [f.name, f]));
  dirCache.set(ck, { map, arr: items, ts: Date.now() });
  return items;
}

async function childrenMap(wps, driveId, parentId) {
  const ck = `${driveId}/${parentId}`;
  const hit = dirCache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_TTL && hit.map) return hit.map;
  await childrenAll(wps, driveId, parentId);
  return dirCache.get(ck)?.map ?? new Map();
}

// 写入操作后失效父目录缓存（PUT/DELETE/Copy/Complete 都会改变目录内容）
function invalidateDir(driveId, parentId) {
  dirCache.delete(`${driveId}/${parentId}`);
}

// 删除对象后清理变空的父目录（WPS 目录是真实实体，S3 语义下 purge/rm 会留空目录）
// 从最深层父目录向上递归；有内容即停。下次 PUT 会自动重建目录。// 上传成功后把新文件注入目录缓存（WPS children 最终一致延迟，HEAD 验证立即可见）
async function seedCache(wps, driveId, parentId, file) {
  if (!file?.name) return;
  const map = await childrenMap(wps, driveId, parentId);
  if (!map) return;
  const node = {
    id: file.id, name: file.name, type: file.type ?? "file",
    size: file.size ?? 0, mtime: file.mtime, hash: file.hash,
  };
  map.set(file.name, node);
  // 目录的排序数组同样要补进去，否则紧接着的列举看不到这个文件
  const entry = dirCache.get(`${driveId}/${parentId}`);
  if (entry?.arr && !entry.arr.some((f) => f.name === file.name)) {
    entry.arr.push(node);
    entry.arr.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
}

async function pruneEmptyFolders(wps, driveId, parentParts) {
  for (let i = parentParts.length; i > 0; i--) {
    const parts = parentParts.slice(0, i);
    const dir = await resolveNode(wps, driveId, parts);
    if (!dir) continue;
    invalidateDir(driveId, dir.id);
    const c = await wps.children(driveId, dir.id);
    if ((c.items ?? []).length > 0) return;
    const t = await wps.post(`/v7/drives/${driveId}/files/batch_delete`, { file_ids: [dir.id] });
    // 等删除任务完成，避免后续请求命中删除中的目录（400 文件不存在）
    for (let n = 0; n < 60; n++) {
      await new Promise((r) => setTimeout(r, 1000));
      const m = await wps.taskMeta(t.task_id);
      if (m.status === "success" || m.failed > 0) break;
    }
    const gp = parts.slice(0, -1);
    const gpNode = gp.length ? await resolveNode(wps, driveId, gp) : { id: "0" };
    invalidateDir(driveId, gpNode.id);
  }
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
async function listTree(wps, driveId, prefix, delimiter, maxKeys, contToken, marker = "") {
  const items = [];
  // 栈元素：{ dirKey, afterName, id }。afterName 是本目录里最后一条已返回的名字——
  // 续页按「名字 > afterName」继续，而不是按数组下标：WPS 的 children 顺序会变，
  // 备份/上传并发写入时下标会错位，导致重复或漏条目。
  let stack = [];
  if (contToken) {
    try { stack = JSON.parse(Buffer.from(contToken, "base64url").toString()); } catch { /* 非法 token 从头开始 */ }
  }
  // V1 marker：网关自己的 NextMarker（base64 token）→ 恢复栈；普通 key → 字典序跳过
  let keyFilter = "";
  if (stack.length === 0 && marker) {
    try { stack = JSON.parse(Buffer.from(marker, "base64url").toString()); }
    catch { keyFilter = marker; }
  }
  if (stack.length === 0) {
    const slash = prefix.lastIndexOf("/");
    stack.push({ dirKey: slash >= 0 ? prefix.slice(0, slash + 1) : "", afterName: "" });
  }

  while (stack.length > 0) {
    const cur = stack.pop();
    // 栈里带 id 就不用再逐级解析；从 token 恢复的旧条目没有 id，回退到 resolveNode
    const base = cur.id ? { id: cur.id } : await resolveNode(wps, driveId, cur.dirKey ? cur.dirKey.split("/").filter(Boolean) : []);
    if (!base) continue;
    const arr = await childrenAll(wps, driveId, base.id);
    const after = cur.afterName ?? "";
    let idx = 0;
    while (idx < arr.length && (arr[idx].name ?? "") <= after) idx++;
    let lastEmitted = after;
    const subdirs = [];
    for (; idx < arr.length; idx++) {
      if (items.length >= maxKeys) break;
      const f = arr[idx];
      const name = f.name ?? "";
      const key = cur.dirKey + name;
      lastEmitted = name;
      if (!key.startsWith(prefix)) continue;
      if (keyFilter && key <= keyFilter) continue;
      if (f.type === "folder") {
        if (delimiter) {
          items.push({ key: key + "/", isCommonPrefix: true });
        } else {
          subdirs.push({ dirKey: key + "/", afterName: "", id: f.id });
        }
      } else {
        items.push({ key, size: f.size, mtime: f.mtime, etag: f.hash?.sum, isCommonPrefix: false });
      }
    }
    // 逆序压栈，弹栈时就是名字升序（DFS 结果与字典序一致）
    for (let i = subdirs.length - 1; i >= 0; i--) {
      stack.push(subdirs[i]);
      prefetchAll(wps, driveId, subdirs[i].id); // 预取整目录，弹栈时命中缓存
    }
    // 本目录没列完：记下最后返回的名字，下次从这里继续
    if (idx < arr.length) stack.push({ dirKey: cur.dirKey, afterName: lastEmitted, id: base.id });
    if (items.length >= maxKeys) break;
  }
  const nextToken = stack.length > 0
    ? Buffer.from(JSON.stringify(stack.slice(0, 50))).toString("base64url")
    : "";
  return { items, nextToken };
}
