// WPS365 OpenAPI 客户端：OAuth2 设备码 + token 续期 + KSO-1 签名 + REST 调用
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Bucket, throttleBody, throttleStream } from "./throttle.js";

export class WpsClient {
  // rates: { upload, download, uploadConcurrency }（字节/秒，0=不限速）
  constructor(cfg, tokenFile, rates = {}) {
    this.cfg = cfg;
    this.tokenFile = tokenFile;
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.rates = { upload: rates.upload ?? 0, download: rates.download ?? 0 };
    // 桶按方向共享：并发 N 个上传合计仍不超过设定速率
    this.uploadBucket = this.rates.upload ? new Bucket(this.rates.upload) : null;
    this.downloadBucket = this.rates.download ? new Bucket(this.rates.download) : null;
    this.load();
  }

  load() {
    if (!fs.existsSync(this.tokenFile)) return;
    try {
      const t = JSON.parse(fs.readFileSync(this.tokenFile, "utf8"));
      this.accessToken = t.access_token ?? null;
      this.refreshToken = t.refresh_token ?? null;
      this.expiresAt = t.expires_at ?? 0;
    } catch { /* 损坏则重新登录 */ }
  }

  save() {
    fs.mkdirSync(path.dirname(this.tokenFile), { recursive: true });
    // 原子写：先写临时文件再 rename。直接覆盖时进程被杀会留下半截 JSON，
    // load() 会静默忽略、退回设备码登录（常驻服务因此卡在等授权）。
    const tmp = `${this.tokenFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires_at: this.expiresAt,
    }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.tokenFile);
  }

  // ── OAuth2 设备码流程（RFC 8628）──────────────────────────────
  async login(scopes) {
    // 1. 请求 device_code
    const base = new URL(this.cfg.tokenUrl).origin;
    const form = new URLSearchParams({ client_id: this.cfg.clientId, scope: scopes });
    const r = await fetch(`${base}/oauth2/device/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const d = await r.json();
    if (d.error) throw new Error(`device authorize: ${d.error}: ${d.error_description ?? ""}`);
    console.log(`\n请在浏览器打开并授权（10 分钟内有效）:\n  ${d.verification_uri}?user_code=${d.user_code}\n`);
    // 2. 轮询换取 token
    const poll = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      device_code: d.device_code,
    });
    for (;;) {
      await new Promise((res) => setTimeout(res, (d.interval ?? 5) * 1000));
      const t = await fetch(base + "/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: poll,
      });
      const td = await t.json();
      // WPS 的轮询响应是 {code, msg} 包装：pending=50000006，成功时 data.access_token
      if (td.access_token || td.data?.access_token) {
        this.setTokens(td.data?.access_token ? { ...td.data, refresh_token: td.data.refresh_token ?? this.refreshToken } : td);
        console.log("✓ 登录成功"); return;
      }
      const errCode = td.code ?? td.error;
      if (errCode === 50000006 || td.error === "authorization_pending") continue;
      if (td.error === "slow_down") { await new Promise((res) => setTimeout(res, 5000)); continue; }
      console.log("[login] 原始响应:", JSON.stringify(td));
      throw new Error(`token: ${td.error ?? td.msg}: ${td.error_description ?? ""}`);
    }
  }

  setTokens(td) {
    this.accessToken = td.access_token;
    this.refreshToken = td.refresh_token ?? this.refreshToken;
    this.expiresAt = Date.now() + (td.expires_in ?? 7200) * 1000 - 60_000; // 提前 1 分钟过期
    this.save();
  }

  // WPS 每次 refresh 都会轮换 refresh_token，用旧值刷新必然 401。
  // tokens.json 可能已被另一个进程（脚本、另一实例）刷新过：刷新前先重读文件采信新值。
  adoptFromFile() {
    if (!fs.existsSync(this.tokenFile)) return;
    try {
      const t = JSON.parse(fs.readFileSync(this.tokenFile, "utf8"));
      if (t.refresh_token && t.refresh_token !== this.refreshToken) {
        this.accessToken = t.access_token ?? this.accessToken;
        this.refreshToken = t.refresh_token;
        this.expiresAt = t.expires_at ?? this.expiresAt;
      }
    } catch { /* 文件损坏就按内存里的来 */ }
  }

  async refresh() {
    this.adoptFromFile();
    if (!this.refreshToken) throw new Error("无 refresh_token，需要重新设备码登录");
    const r = await fetch(this.cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        refresh_token: this.refreshToken,
      }),
    });
    const d = await r.json();
    if (!d.access_token) throw new Error(`refresh failed: ${d.error ?? r.status}`);
    this.setTokens(d);
  }

  async ensureToken() {
    if (this.accessToken && Date.now() < this.expiresAt) return;
    await this.refresh();
  }

  // ── KSO-1 签名 ────────────────────────────────────────────────
  // ── KSO-1 签名（kso 域接口；上传实体文件无论开关如何都要求）──
  // signature = HMAC-SHA256(secretKey, "KSO-1" + Method + RequestURI + ContentType + KsoDate + sha256(body))
  // 空 body 时 sha256 部分为空字符串（官方 Python 示例语义），非空才计算哈希
  kso1Headers(method, uri, body, contentType = "application/json", bodySha256 = null) {
    const date = new Date().toUTCString();
    const sha256 = bodySha256 ?? (body && body.length > 0
      ? crypto.createHash("sha256").update(body).digest("hex")
      : "");
    const mac = crypto.createHmac("sha256", this.cfg.clientSecret)
      .update(`KSO-1${method}${uri}${contentType}${date}${sha256}`)
      .digest("hex");
    return {
      "Content-Type": contentType,
      "X-Kso-Date": date,
      "X-Kso-Authorization": `KSO-1 ${this.cfg.clientId}:${mac}`,
    };
  }

  // 网络层重试：WPS 侧偶发 ECONNRESET / 连接被重置时，fetch 直接 reject。
  // 这类失败在客户端看来是 500，rustic 会退避重试，但一次抖动就可能让整轮备份的
  // 索引写入掉队（整轮索引都要重传）。网关内部补 2 次、间隔 200/500ms。
  // make() 每次调用都要新建请求（body 流不能复用）。
  async fetchRetry(make, enabled = true, attempts = 3) {
    for (let i = 0; ; i++) {
      try {
        return await make();
      } catch (e) {
        if (!enabled || i + 1 >= attempts) throw e;
        await new Promise((r) => setTimeout(r, 200 * 2 ** i));
      }
    }
  }

  // ── REST 调用 ─────────────────────────────────────────────────
  async request(method, uri, body, opts = {}) {
    await this.ensureToken();
    const rawBody = body ? JSON.stringify(body) : undefined;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      ...(this.cfg.kso1Sign ? this.kso1Headers(method, uri, rawBody) : {}),
      ...(rawBody ? { "Content-Type": "application/json" } : {}),
    };
    // 限流（429000001，WPS 对 token 校验接口的频率限制，窗口秒级）短退避重试：1s/2s/4s
    // 默认只对 GET 做网络重试：POST 可能是 create/copy，重试会造出重复对象
    const retryNet = opts.retryNet ?? method === "GET";
    const { retryNet: _ignored, ...fetchOpts } = opts;
    for (let attempt = 0; ; attempt++) {
      const r = await this.fetchRetry(() => fetch(this.cfg.apiBase + uri, { method, headers, body: rawBody, ...fetchOpts }), retryNet);
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.code !== 0) {
        // token 过期/失效时用 refresh_token 重试一次
        if (r.status === 401 || data.code === 400000003 || data.code === 401000001) {
          await this.refresh();
          return this.request(method, uri, body, opts);
        }
        if (data.code === 429000001 || r.status === 429) {
          if (attempt < 3) {
            await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt));
            continue;
          }
        }
        const err = new Error(`WPS ${method} ${uri}: ${r.status} ${data.msg ?? data.message ?? ""} (${data.code ?? ""})`);
        err.code = data.code;
        throw err;
      }
      return data.data;
    }
  }

  async get(uri)  { return this.request("GET", uri); }
  async post(uri, body) { return this.request("POST", uri, body); }

  // ── 业务 API ──────────────────────────────────────────────────
  listDrives()        { return this.get("/v7/drives?allotee_type=user&page_size=100"); }
  listDoclibs()       { return this.get("/v7/doclibs?page_size=100"); }
  children(driveId, parentId, pageToken) {
    const tok = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "";
    return this.get(`/v7/drives/${driveId}/files/${parentId}/children?page_size=500${tok}`);
  }
  meta(driveId, fileId) {
    return this.get(`/v7/drives/${driveId}/files/${fileId}/meta`);
  }
  async downloadUrl(driveId, fileId) {
    const d = await this.get(`/v7/drives/${driveId}/files/${fileId}/download`);
    return d.url;
  }
  async createFolder(driveId, parentId, name) {
    return this.post(`/v7/drives/${driveId}/files/${parentId}/create`, {
      name, file_type: "folder", on_name_conflict: "rename",
    });
  }
  async deleteFile(driveId, fileId) {
    return this.post(`/v7/drives/${driveId}/files/${fileId}/delete`, {});
  }
  // 三段式上传：request_upload → PUT 直传（KSO-1 签名）→ commit_upload
  // 公网必传 hashes（sha256 至少一种）
  async requestUpload(driveId, parentId, name, body) {
    const sha256 = crypto.createHash("sha256").update(body).digest("hex");
    return this.requestUploadHashed(driveId, parentId, name, body.length, sha256);
  }

  // body 已在别处落盘/算过哈希时用这个：避免把大文件读进内存
  requestUploadHashed(driveId, parentId, name, size, sha256) {
    return this.post(`/v7/drives/${driveId}/files/${parentId}/request_upload`, {
      name,
      size,
      hashes: [{ type: "sha256", sum: sha256 }],
      on_name_conflict: "overwrite", // S3 PUT 覆盖语义（rename 会产生 (N) 孤儿，rclone 死循环）
    }, { retryNet: true }); // 重试只会多建一个会过期的上传任务，幂等
  }

  // 直传实体文件到云存储：KSO-1 签名 + 与申请接口相同的登录凭据（Bearer）
  // 公网 wps.cn/kdocs.cn 域要求带登录凭据（文档「上传实体文件」）
  async uploadStore(storeRequest, body) {
    const url = new URL(storeRequest.url);
    const contentType = "application/octet-stream";
    const headers = this.kso1Headers(storeRequest.method ?? "PUT", url.pathname + url.search, body, contentType);
    headers["Content-Length"] = body.length;
    headers["Authorization"] = `Bearer ${this.accessToken}`;
    const up = await this.fetchRetry(() => {
      const out = throttleBody(body, this.uploadBucket); // 每次重试都要新建流
      return fetch(url, {
        method: storeRequest.method ?? "PUT", headers, body: out,
        ...(out === body ? {} : { duplex: "half" }), // 流式 body 需要显式 half-duplex
      });
    });
    if (!up.ok) throw new Error(`store upload failed: ${up.status} ${(await up.text()).slice(0, 120)}`);
  }
  async commitUpload(driveId, parentId, uploadId) {
    return this.post(`/v7/drives/${driveId}/files/${parentId}/commit_upload`, { upload_id: uploadId });
  }

  // 从磁盘文件直传（restic pack 可达 128MB，不能整块进内存）；哈希已在落盘时算好
  async uploadStoreHashed(storeRequest, filePath, size, sha256) {
    const url = new URL(storeRequest.url);
    const contentType = "application/octet-stream";
    const headers = this.kso1Headers(storeRequest.method ?? "PUT", url.pathname + url.search, null, contentType, sha256);
    headers["Content-Length"] = String(size);
    headers["Authorization"] = `Bearer ${this.accessToken}`;
    // 每次尝试重新打开文件流：流被消费过一次就不能复用
    const up = await this.fetchRetry(() => {
      const src = fs.createReadStream(filePath);
      const body = this.uploadBucket ? src.pipe(throttleStream(this.uploadBucket)) : src;
      return fetch(url, { method: storeRequest.method ?? "PUT", headers, body, duplex: "half" })
        .finally(() => src.destroy());
    });
    if (!up.ok) throw new Error(`store upload failed: ${up.status} ${(await up.text()).slice(0, 120)}`);
    await up.arrayBuffer(); // 排空响应
  }

  // ── 分块上传（WPS 固定块大小，服务端下发 part_size）────────────
  // create task 必须提供真实 size + 整体 sha256（公网强制）
  async multipartCreate(driveId, parentId, name, size, sha256Hex) {
    return this.post(`/v7/drives/${driveId}/files/${parentId}/create_multipart_upload_task`, {
      name, size, mode: "sequential",
      hashes: [{ type: "sha256", sum: sha256Hex }],
      on_name_conflict: "overwrite", // 同上：S3 PUT 覆盖语义
    });
  }

  // 上传单个分块：PUT upload_addr?part_number=N，KSO-1 + Bearer + Content-MD5
  async multipartPutPart(uploadAddr, partNumber, data) {
    const url = new URL(uploadAddr);
    const uri = url.pathname + url.search + (url.search ? "&" : "?") + `part_number=${partNumber}`;
    const headers = this.kso1Headers("PUT", uri, data, "application/octet-stream");
    headers["Content-Length"] = data.length;
    headers["Content-MD5"] = crypto.createHash("md5").update(data).digest("base64");
    headers["Authorization"] = `Bearer ${this.accessToken}`;
    const out = throttleBody(data, this.uploadBucket);
    const up = await fetch(url.origin + uri, {
      method: "PUT", headers, body: out,
      ...(out === data ? {} : { duplex: "half" }),
    });
    if (!up.ok) throw new Error(`multipart part ${partNumber}: ${up.status} ${(await up.text()).slice(0, 120)}`);
  }

  // 合并分块并建文件；合并中可能返回 409007001，至少 2 秒后重试
  async multipartCommit(uploadId) {
    for (let i = 0; i < 6; i++) {
      try {
        return await this.post(`/v7/multipart_upload_tasks/${uploadId}/commit`, {});
      } catch (e) {
        if (e.code !== 409007001 || i === 5) throw e;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  async multipartAbort(uploadId) {
    return this.post(`/v7/multipart_upload_tasks/${uploadId}/abort`, {});
  }

  // ── 复制（异步任务 + 轮询）────────────────────────────────────
  // 返回复制出的文件 id（用于 S3 CopyObject 的目标名重命名）
  async copyFile(driveId, srcFileId, dstDriveId, dstParentId) {
    const t = await this.post(`/v7/drives/${driveId}/files/batch_copy`, {
      dst_drive_id: dstDriveId, dst_parent_id: dstParentId, file_ids: [srcFileId],
    });
    const taskId = t.task_id;
    for (let i = 0; i < 60; i++) { // 最多等 ~2 分钟
      await new Promise((r) => setTimeout(r, 2000));
      const meta = await this.taskMeta(taskId);
      if (meta.failed > 0) throw new Error(`copy task failed: ${taskId}`);
      if (meta.status === "success" || meta.status === "done") {
        return meta.file_pairs?.[0]?.dst_file_id;
      }
    }
    throw new Error(`copy task timeout: ${taskId}`);
  }

  renameFile(driveId, fileId, dstName) {
    return this.post(`/v7/drives/${driveId}/files/${fileId}/rename`, { dst_name: dstName });
  }

  taskMeta(taskId) { return this.get(`/v7/drive_tasks/${taskId}/meta`); }
}
