// 上传/下载限速：全局令牌桶 + 分片流。
// 桶是「方向」级共享的：多个并发上传/下载合计不超过设定速率（否则 N 并发就是 N 倍）。
// 大对象必须切成小块再节流，否则整块 Buffer 作为单个 chunk 只会被延迟一次然后原速吐出。
import { Readable, Transform } from "node:stream";

const CHUNK = 64 * 1024;

// "2MiB" / "500KiB/s" / "1.5MB" / 1048576 → 字节/秒；0 或空表示不限速
export function parseRate(v) {
  if (v === undefined || v === null || v === "" || v === 0 || v === "0") return 0;
  if (typeof v === "number") return v > 0 ? v : 0;
  const m = /^\s*([\d.]+)\s*([kmgt]?i?b)?\s*(?:\/\s*s)?\s*$/i.exec(String(v));
  if (!m) throw new Error(`无法解析速率: ${v}`);
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "b").toLowerCase();
  const mult = { b: 1, kb: 1000, mb: 1e6, gb: 1e9, tb: 1e12,
                 kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 }[unit];
  if (!mult) throw new Error(`无法解析速率单位: ${v}`);
  return Math.round(n * mult);
}

// 令牌桶：多个流共用一个实例，合计速率受控
export class Bucket {
  constructor(bytesPerSec, burstBytes = CHUNK) {
    this.rate = bytesPerSec;
    this.burst = burstBytes;
    this.tokens = burstBytes;
    this.last = Date.now();
  }

  // 领取 n 字节的发送许可；不足则等待到够为止
  take(n) {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    this.tokens -= n;
    if (this.tokens >= 0) return Promise.resolve();
    const waitMs = (-this.tokens / this.rate) * 1000;
    this.tokens = 0;
    this.last = now + waitMs; // 虚拟时间推进到发出时刻：等待期间不产生新信用
    return new Promise((res) => setTimeout(res, waitMs));
  }
}

// 把上游数据接到桶上：每块先领许可再放行
export function throttleStream(bucket) {
  return new Transform({
    async transform(chunk, _enc, cb) {
      await bucket.take(chunk.length);
      cb(null, chunk);
    },
  });
}

// Buffer → 固定大小分片的可读流（subarray 是视图，不复制）
export function chunked(buf, size = CHUNK) {
  return Readable.from((function* () {
    for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
  })());
}

// 上传用：有桶就切片 + 节流，没有桶则原样返回 Buffer（走非流式路径）
export function throttleBody(buf, bucket) {
  return bucket ? chunked(buf).pipe(throttleStream(bucket)) : buf;
}
