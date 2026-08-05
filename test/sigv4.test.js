// SigV4 验证自检：用 aws4 客户端签名请求，验证服务端校验逻辑
import test from "node:test";
import assert from "node:assert";
import aws4 from "aws4";
import { verifySigV4, parseAuth } from "../src/sigv4.js";

const creds = [{ accessKey: "gateway-admin", secretKey: "test-secret" }];

// 模拟真实 HTTP 请求：header 名全小写（Node http 的行为）
function lowerHeaders(h) {
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
}

function signReq({ method = "GET", path = "/", body = "", extraHeaders = {} }) {
  const req = { method, path, host: "127.0.0.1:9000", headers: { host: "127.0.0.1:9000", ...extraHeaders }, body };
  const signed = aws4.sign(
    { ...req, service: "s3", region: "us-east-1" },
    { accessKeyId: creds[0].accessKey, secretAccessKey: creds[0].secretKey }
  );
  return { headers: lowerHeaders(signed.headers), url: path };
}

test("parseAuth 解析 Authorization 头", () => {
  const { headers } = signReq({});
  const auth = parseAuth(headers.authorization);
  assert.ok(auth);
  assert.equal(auth.accessKey, "gateway-admin");
  assert.equal(auth.service, "s3");
});

test("合法 GET 签名通过验证", () => {
  const signed = signReq({ path: "/" });
  const ok = verifySigV4(
    { method: "GET", url: "/", headers: signed.headers, rawBody: Buffer.from("") },
    creds
  );
  assert.equal(ok, true);
});

test("带 query 的 GET 通过", () => {
  const p = "/personal?list-type=2&prefix=a%2Fb";
  const signed = signReq({ path: p });
  const ok = verifySigV4(
    { method: "GET", url: p, headers: signed.headers, rawBody: Buffer.from("") },
    creds
  );
  assert.equal(ok, true);
});

test("带 body 的 PUT 通过", () => {
  const body = Buffer.from("hello world");
  const signed = signReq({ method: "PUT", path: "/personal/x.txt", body });
  const ok = verifySigV4(
    { method: "PUT", url: "/personal/x.txt", headers: signed.headers, rawBody: body },
    creds
  );
  assert.equal(ok, true);
});

test("篡改 body 后签名失败", () => {
  const body = Buffer.from("hello world");
  const signed = signReq({ method: "PUT", path: "/personal/x.txt", body });
  const ok = verifySigV4(
    { method: "PUT", url: "/personal/x.txt", headers: signed.headers, rawBody: Buffer.from("tampered") },
    creds
  );
  assert.equal(ok, false);
});

test("未知 accessKey 拒绝", () => {
  const signed = signReq({});
  const ok = verifySigV4(
    { method: "GET", url: "/", headers: signed.headers, rawBody: Buffer.from("") },
    [{ accessKey: "other", secretKey: "x" }]
  );
  assert.equal(ok, false);
});

test("无 Authorization 头拒绝", () => {
  const ok = verifySigV4({ method: "GET", url: "/", headers: {}, rawBody: Buffer.from("") }, creds);
  assert.equal(ok, false);
});
