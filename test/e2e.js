// E2E 测试：PUT/GET(Range)/DELETE/CopyObject/Multipart（需网关运行 + 真实 WPS 凭证）
// 用法: node test/e2e.js
import aws4 from "aws4";
import http from "http";
import crypto from "node:crypto";

const HOST = "127.0.0.1", PORT = 9000;
const creds = { accessKeyId: "gateway-test", secretAccessKey: "gateway-test-secret" };
const BUCKET = "personal";
const KEY = "e2e-test/";

function call(method, path, { body, headers = {}, query = "" } = {}) {
  const p = path + query;
  const signed = aws4.sign({
    method, path: p, host: `${HOST}:${PORT}`,
    headers: { host: `${HOST}:${PORT}`, ...headers }, body: body ?? "",
    service: "s3", region: "us-east-1",
  }, creds);
  return new Promise((resolve, reject) => {
    const r = http.request({ host: HOST, port: PORT, method, path: p, headers: signed.headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    });
    r.on("error", reject);
    r.end(body ?? "");
  });
}

let failed = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : " " + detail}`);
  if (!cond) failed++;
}

// 清理历史残留（重跑幂等）
for (const k of ["plain.txt", "copy.txt", "big.bin"]) {
  await call("DELETE", `/${BUCKET}/${KEY}${k}`);
}

// 1. 普通 PUT
const content = Buffer.from("e2e content " + crypto.randomBytes(64).toString("hex"));
let r = await call("PUT", `/${BUCKET}/${KEY}plain.txt`, { body: content });
check("PutObject", r.status === 200, `${r.status} ${r.body}`);

// 2. GET 完整下载
r = await call("GET", `/${BUCKET}/${KEY}plain.txt`);
check("GetObject", r.status === 200 && r.body.equals(content), `${r.status} ${r.body.slice(0, 50)}`);

// 3. GET Range
r = await call("GET", `/${BUCKET}/${KEY}plain.txt`, { headers: { Range: "bytes=0-9" } });
check("GetObject Range", r.status === 206 && r.body.length === 10 && r.headers["content-range"].startsWith("bytes 0-9/"), `${r.status} len=${r.body.length} cr=${r.headers["content-range"]}`);

// 4. CopyObject
r = await call("PUT", `/${BUCKET}/${KEY}copy.txt`, { headers: { "x-amz-copy-source": `/${BUCKET}/${KEY}plain.txt` } });
check("CopyObject", r.status === 200, `${r.status} ${r.body}`);
r = await call("GET", `/${BUCKET}/${KEY}copy.txt`);
check("CopyObject 内容一致", r.body.equals(content), `${r.status} ${r.body.slice(0, 30)}`);

// 5. Multipart（3 个 part，模拟客户端分块）
const big = crypto.randomBytes(7 * 1024 * 1024); // 7MB
const partSize = 3 * 1024 * 1024;
const parts = [big.subarray(0, partSize), big.subarray(partSize, partSize * 2), big.subarray(partSize * 2)];
r = await call("POST", `/${BUCKET}/${KEY}big.bin`, { query: "?uploads" });
check("CreateMultipartUpload", r.status === 200, `${r.status} ${r.body}`);
const m = r.body.toString().match(/<UploadId>([^<]+)<\/UploadId>/);
const uploadId = m?.[1];
check("拿到 UploadId", !!uploadId, r.body.toString());
for (let i = 0; i < parts.length; i++) {
  r = await call("PUT", `/${BUCKET}/${KEY}big.bin`, { body: parts[i], query: `?partNumber=${i + 1}&uploadId=${uploadId}` });
  check(`UploadPart #${i + 1}`, r.status === 200, `${r.status} ${r.body}`);
}
r = await call("POST", `/${BUCKET}/${KEY}big.bin`, { query: `?uploadId=${uploadId}` });
check("CompleteMultipartUpload", r.status === 200, `${r.status} ${r.body.toString().slice(0, 200)}`);
r = await call("GET", `/${BUCKET}/${KEY}big.bin`);
check("Multipart 内容一致", r.status === 200 && r.body.length === big.length, `${r.status} len=${r.body.length}`);

// 6. AbortMultipartUpload
r = await call("POST", `/${BUCKET}/${KEY}abort.bin`, { query: "?uploads" });
const uid2 = r.body.toString().match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
r = await call("PUT", `/${BUCKET}/${KEY}abort.bin`, { body: Buffer.from("partial"), query: `?partNumber=1&uploadId=${uid2}` });
r = await call("DELETE", `/${BUCKET}/${KEY}abort.bin`, { query: `?uploadId=${uid2}` });
check("AbortMultipartUpload", r.status === 204, `${r.status}`);

// 7. 清理
for (const k of ["plain.txt", "copy.txt", "big.bin"]) {
  r = await call("DELETE", `/${BUCKET}/${KEY}${k}`);
  check(`Delete ${k}`, r.status === 204, `${r.status}`);
}

console.log(failed === 0 ? "\n全部通过 🎉" : `\n${failed} 项失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
