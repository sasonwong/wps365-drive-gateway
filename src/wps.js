// WPS365 OpenAPI 客户端：OAuth2 设备码 + token 续期 + KSO-1 签名 + REST 调用
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class WpsClient {
  constructor(cfg, tokenFile) {
    this.cfg = cfg;
    this.tokenFile = tokenFile;
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
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
    fs.writeFileSync(this.tokenFile, JSON.stringify({
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires_at: this.expiresAt,
    }, null, 2), { mode: 0o600 });
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
      if (td.access_token) { this.setTokens(td); console.log("✓ 登录成功"); return; }
      if (td.error === "authorization_pending") continue;
      throw new Error(`token: ${td.error}: ${td.error_description ?? ""}`);
    }
  }

  setTokens(td) {
    this.accessToken = td.access_token;
    this.refreshToken = td.refresh_token ?? this.refreshToken;
    this.expiresAt = Date.now() + (td.expires_in ?? 7200) * 1000 - 60_000; // 提前 1 分钟过期
    this.save();
  }

  async refresh() {
    if (!this.refreshToken) return;
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
  kso1Headers(method, uri, body, contentType = "application/json") {
    const date = new Date().toUTCString();
    const sha256 = body && body.length > 0
      ? crypto.createHash("sha256").update(body).digest("hex")
      : "";
    const mac = crypto.createHmac("sha256", this.cfg.clientSecret)
      .update(`KSO-1${method}${uri}${contentType}${date}${sha256}`)
      .digest("hex");
    return {
      "Content-Type": contentType,
      "X-Kso-Date": date,
      "X-Kso-Authorization": `KSO-1 ${this.cfg.clientId}:${mac}`,
    };
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
    const r = await fetch(this.cfg.apiBase + uri, {
      method, headers, body: rawBody, ...opts,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.code !== 0) {
      // token 过期时重试一次
      if (r.status === 401 || data.code === 400000003) {
        await this.refresh();
        return this.request(method, uri, body, opts);
      }
      const err = new Error(`WPS ${method} ${uri}: ${r.status} ${data.msg ?? data.message ?? ""} (${data.code ?? ""})`);
      err.code = data.code;
      throw err;
    }
    return data.data;
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
    return this.post(`/v7/drives/${driveId}/files/${parentId}/request_upload`, {
      name,
      size: body.length,
      hashes: [{ type: "sha256", sum: sha256 }],
      on_name_conflict: "rename",
    });
  }

  // 直传实体文件到云存储：KSO-1 签名 + 与申请接口相同的登录凭据（Bearer）
  // 公网 wps.cn/kdocs.cn 域要求带登录凭据（文档「上传实体文件」）
  async uploadStore(storeRequest, body) {
    const url = new URL(storeRequest.url);
    const contentType = "application/octet-stream";
    const headers = this.kso1Headers(storeRequest.method ?? "PUT", url.pathname + url.search, body, contentType);
    headers["Content-Length"] = body.length;
    headers["Authorization"] = `Bearer ${this.accessToken}`;
    const up = await fetch(url, { method: storeRequest.method ?? "PUT", headers, body });
    if (!up.ok) throw new Error(`store upload failed: ${up.status} ${(await up.text()).slice(0, 120)}`);
  }
  async commitUpload(driveId, parentId, uploadId) {
    return this.post(`/v7/drives/${driveId}/files/${parentId}/commit_upload`, { upload_id: uploadId });
  }
}
