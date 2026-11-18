// 限速与切片单测（无网络）
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRate, Bucket, throttleStream, chunked, throttleBody } from "../src/throttle.js";

test("parseRate 解析带单位/裸数字/关闭", () => {
  assert.equal(parseRate("2MiB"), 2 * 1024 ** 2);
  assert.equal(parseRate("2MiB/s"), 2 * 1024 ** 2);
  assert.equal(parseRate("500KiB"), 500 * 1024);
  assert.equal(parseRate("1.5MB"), 1_500_000);
  assert.equal(parseRate(1048576), 1048576);
  assert.equal(parseRate("0"), 0);
  assert.equal(parseRate(0), 0);
  assert.equal(parseRate(undefined), 0);
  assert.throws(() => parseRate("fast"));
  assert.throws(() => parseRate("2XB"));
});

test("chunked 按 64 KiB 切片且不复制内容", () => {
  const buf = Buffer.alloc(300 * 1024, 9);
  const sizes = [];
  return (async () => {
    for await (const c of chunked(buf)) sizes.push(c.length);
    assert.deepEqual(sizes, [64 * 1024, 64 * 1024, 64 * 1024, 64 * 1024, 44 * 1024]);
    assert.equal(sizes.reduce((a, b) => a + b, 0), buf.length);
  })();
});

test("throttleStream 把 300 KiB @200KiB/s 拉长到 ~1.2s 且字节完整", async () => {
  const buf = Buffer.alloc(300 * 1024, 1);
  const bucket = new Bucket(200 * 1024);
  const t0 = Date.now();
  let got = 0;
  for await (const c of chunked(buf).pipe(throttleStream(bucket))) got += c.length;
  const ms = Date.now() - t0;
  assert.equal(got, buf.length);
  // 令牌桶有 64 KiB 初始信用，理论耗时 (300-64)/200 ≈ 1.18s；低于 1s 说明没限住
  assert.ok(ms >= 1000, `实际 ${ms}ms，应 >= 1000ms`);
});

test("共用同一个桶时，两个并发流合计速率不超过设定（不是各限一份）", async () => {
  const bucket = new Bucket(200 * 1024);
  const run = async () => {
    const buf = Buffer.alloc(200 * 1024, 2);
    let n = 0;
    for await (const c of chunked(buf).pipe(throttleStream(bucket))) n += c.length;
    return n;
  };
  const t0 = Date.now();
  const [a, b] = await Promise.all([run(), run()]);
  const ms = Date.now() - t0;
  assert.equal(a + b, 400 * 1024);
  // 400 KiB @200KiB/s ≈ 2s（减去 64 KiB 初始信用后 ≈1.7s）；若各自一份桶会只要 ~1.2s
  assert.ok(ms >= 1600, `实际 ${ms}ms，应 >= 1600ms（说明桶是共享的）`);
});

test("throttleBody 在 rate=0 时原样返回 Buffer（不改现有路径）", () => {
  const buf = Buffer.from("abc");
  assert.equal(throttleBody(buf, 0), buf);
  assert.equal(throttleBody(buf, 0).length, 3);
});
