// AWS Signature V4 服务端验证（标准算法，参考 AWS SigV4 规范）
import crypto from "node:crypto";

const AUTH_RE = /AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]*)\/([^/]*)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})/;

export function parseAuth(authHeader) {
  const m = AUTH_RE.exec(authHeader ?? "");
  if (!m) return null;
  return {
    accessKey: m[1], date: m[2], region: m[3] || "us-east-1", service: m[4] || "s3",
    signedHeaders: m[5].split(";"), signature: m[6],
  };
}

// AWS URI 编码：unreserved 字符保留，其余百分号编码
function uriEncode(s) {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// 校验请求签名。req: { method, url(原始 path+query), headers, rawBody(Buffer) }
export function verifySigV4(req, credentials, opts = {}) {
  const auth = parseAuth(req.headers.authorization);
  if (!auth) return false;
  const cred = credentials.find((c) => c.accessKey === auth.accessKey);
  if (!cred) return false;

  // 时间窗口检查（防重放），宽松 15 分钟
  const amzDate = req.headers["x-amz-date"] ?? req.headers.date;
  if (amzDate && opts.checkTimestamp !== false) {
    const t = Date.parse(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
    if (!Number.isNaN(t) && Math.abs(Date.now() - t) > 15 * 60_000) return false;
  }

  // 拆分 path 与 query
  const qIdx = req.url.indexOf("?");
  const canonicalUri = qIdx === -1 ? req.url : req.url.slice(0, qIdx);
  const query = qIdx === -1 ? "" : req.url.slice(qIdx + 1);

  // canonical query：URLSearchParams 解析（自动 decode）后按 key 排序 re-encode
  const params = new URLSearchParams(query);
  const canonicalQuery = [...params.entries()]
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join("&");

  // canonical headers：仅 SignedHeaders 列出的头，小写 key，值压缩空白
  const signedSet = new Set(auth.signedHeaders);
  const canonicalHeaders = auth.signedHeaders
    .map((h) => {
      const v = req.headers[h];
      if (v === undefined) return null;
      return `${h}:${String(v).trim().replace(/\s+/g, " ")}\n`;
    })
    .filter(Boolean)
    .join("");

  // payload hash：优先 x-amz-content-sha256；hex 值时校验 body 未被篡改
  const declared = req.headers["x-amz-content-sha256"];
  let payloadHash;
  if (!declared) {
    payloadHash = sha256Hex(req.rawBody ?? Buffer.alloc(0));
  } else if (declared === "UNSIGNED-PAYLOAD") {
    payloadHash = declared;
  } else if (/^[0-9a-f]{64}$/.test(declared)) {
    if (sha256Hex(req.rawBody ?? Buffer.alloc(0)) !== declared) return false; // body 被篡改
    payloadHash = declared;
  } else {
    return false; // STREAMING-* 等签名暂不支持
  }

  const canonicalRequest = [
    req.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    auth.signedHeaders.join(";"),
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${auth.date}/${auth.region}/${auth.service}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  let key = hmac(Buffer.from("AWS4" + cred.secretKey, "utf8"), auth.date);
  key = hmac(key, auth.region);
  key = hmac(key, auth.service);
  key = hmac(key, "aws4_request");
  const expected = hmac(key, stringToSign).toString("hex");

  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(auth.signature, "hex"));
}

export function sigV4Error() {
  return {
    status: 403,
    xml: `<?xml version="1.0" encoding="UTF-8"?><Error><Code>SignatureDoesNotMatch</Code><Message>The request signature we calculated does not match the signature you provided.</Message></Error>`,
  };
}
