// S3 协议层单测：V1/V2 列表分页（token + 普通 key marker）、GetBucketLocation、
// ListMultipartUploads、ListParts。纯本地（fake WPS + aws4 签名），无需真实凭证。
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import aws4 from "aws4";
import { createS3App } from "../src/s3.js";

// fake WPS：root 下 20 个文件 f01..f20；children 返回倒序，验证分页不依赖顺序
const files = Array.from({ length: 20 }, (_, i) => ({
  id: `file-${i + 1}`, name: `f${String(i + 1).padStart(2, "0")}`, type: "file", size: i + 1, mtime: 1700000000 + i,
}));
const fakeWps = { accessToken: "test", children: async () => ({ items: [...files].reverse(), next_page_token: "" }) };

const app = createS3App({
  wps: fakeWps,
  buckets: [{ name: "personal", driveId: "drive-1" }],
  creds: [{ accessKey: "test", secretKey: "test-secret" }],
  readOnly: false, tokenFile: null, pruneEmptyDirs: false,
});
const server = app.listen(0);
after(() => new Promise((r) => server.close(r))); // 关掉 server，否则进程不退出

function call(method, path, { body, headers = {} } = {}) {
  const host = `127.0.0.1:${server.address().port}`;
  const signed = aws4.sign({
    method, path, host,
    headers: { host, ...headers }, body: body ?? "",
    service: "s3", region: "us-east-1",
  }, { accessKeyId: "test", secretAccessKey: "test-secret" });
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: server.address().port, method, path, headers: signed.headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    r.on("error", reject);
    r.end(body ?? "");
  });
}

const allKeys = Array.from({ length: 20 }, (_, i) => `f${String(i + 1).padStart(2, "0")}`).sort();
const keysIn = (body) => [...body.matchAll(/<Key>(f\d+)<\/Key>/g)].map((m) => m[1]).sort();

test("ListObjectsV1 分页：NextMarker token 回传续页", async () => {
  const keys = [];
  let marker = "";
  for (let i = 0; i < 10; i++) {
    const r = await call("GET", "/personal?list-type=1&max-keys=7" + (marker ? `&marker=${encodeURIComponent(marker)}` : ""));
    assert.equal(r.status, 200);
    assert.match(r.body, /<Marker>/);          // V1 有 Marker、无 KeyCount
    assert.doesNotMatch(r.body, /KeyCount/);
    keys.push(...keysIn(r.body));
    if (!/<IsTruncated>true/.test(r.body)) break;
    marker = r.body.match(/<NextMarker>([^<]+)<\/NextMarker>/)?.[1];
    assert.ok(marker);
  }
  assert.deepEqual(keys.sort(), allKeys);
});

test("ListObjectsV1 普通 key marker（客户端拿最后 key 续页）", async () => {
  const r = await call("GET", "/personal?list-type=1&max-keys=100&marker=f07");
  assert.deepEqual(keysIn(r.body), allKeys.slice(7)); // 跳过 f01..f07
});

test("ListObjectsV2 分页：ContinuationToken 回传续页 + KeyCount", async () => {
  const keys = [];
  let token = "";
  let sawKeyCount = false;
  for (let i = 0; i < 10; i++) {
    const r = await call("GET", "/personal?list-type=2&max-keys=7" + (token ? `&continuation-token=${encodeURIComponent(token)}` : ""));
    assert.equal(r.status, 200);
    if (i > 0) assert.match(r.body, /<ContinuationToken>/); // 后续页回显 token
    assert.match(r.body, /<KeyCount>\d+<\/KeyCount>/);
    sawKeyCount ||= true;
    keys.push(...keysIn(r.body));
    if (!/<IsTruncated>true/.test(r.body)) break;
    token = r.body.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
    assert.ok(token);
  }
  assert.equal(sawKeyCount, true);
  assert.deepEqual(keys.sort(), allKeys);
});

test("GetBucketLocation", async () => {
  const r = await call("GET", "/personal?location=");
  assert.equal(r.status, 200);
  assert.match(r.body, /<LocationConstraint[^>]*>us-east-1<\/LocationConstraint>/);
});

test("ListMultipartUploads 返回空列表", async () => {
  const r = await call("GET", "/personal?uploads");
  assert.equal(r.status, 200);
  assert.match(r.body, /<ListMultipartUploadsResult/);
  assert.match(r.body, /<IsTruncated>false<\/IsTruncated>/);
  assert.doesNotMatch(r.body, /<Upload>/);
});

test("ListParts 返回已上传分片；未知 uploadId → NoSuchUpload", async () => {
  let r = await call("POST", "/personal/big.bin?uploads");
  const uploadId = r.body.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  assert.ok(uploadId);
  await call("PUT", `/personal/big.bin?partNumber=1&uploadId=${uploadId}`, { body: "hello" });
  await call("PUT", `/personal/big.bin?partNumber=2&uploadId=${uploadId}`, { body: "world" });
  r = await call("GET", `/personal/big.bin?uploadId=${uploadId}`);
  assert.equal(r.status, 200);
  assert.match(r.body, /<ListPartsResult/);
  assert.match(r.body, /<PartNumber>1<\/PartNumber>/);
  assert.match(r.body, /<PartNumber>2<\/PartNumber>/);
  assert.match(r.body, /<Size>5<\/Size>/);

  r = await call("GET", "/personal/big.bin?uploadId=ghost");
  assert.equal(r.status, 404);
  assert.match(r.body, /NoSuchUpload/);
});
