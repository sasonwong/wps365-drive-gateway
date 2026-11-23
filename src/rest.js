// Restic REST backend（restic/rest-server 兼容子集）
// 协议面：/<repo>/config 以及 /<repo>/{data,index,keys,locks,snapshots}/<sha256>
// 只服务 restic / rustic，不提供浏览、改名的文件系统语义。
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { throttleStream } from "./throttle.js";

const TYPES = new Set(["data", "index", "keys", "locks", "snapshots"]);
const HEX64 = /^[0-9a-f]{64}$/;
const V1 = "application/vnd.x.restic.rest.v1";
const V2 = "application/vnd.x.restic.rest.v2";
const LIST_TTL = 60_000;    // 目录内容缓存：只用于外部改动，本进程写操作会即时更新
const MAX_PAGES = 2000;     // 2000 页 × 500 = 100 万条，防服务端一直给 token
const SHARD_CONCURRENCY = 16;

// Basic 认证。restic 把用户名密码放在 URL 里，每个请求都带。
function basicOk(header, creds) {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const i = decoded.indexOf(":"); // 密码里可以有冒号
  const user = decoded.slice(0, i), pass = decoded.slice(i + 1);
  return creds.some((c) => timingEq(user, c.accessKey) && timingEq(pass, c.secretKey));
}
function timingEq(a, b) {
  const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createRestApp({ wps, buckets, creds, readOnly = false, uploadConcurrency = 2 }) {
  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    if (!basicOk(req.headers.authorization, creds)) {
      res.set("WWW-Authenticate", 'Basic realm="restic"');
      return res.status(401).type("text/plain").send("unauthorized");
    }
    next();
  });

  // ── 目录内容缓存：${driveId}/${parentId} → {map, ts} | {p} ──────
  // 进程内所有读都走它；写操作直接改 map，所以自己的写入立即可见。
  const dirMaps = new Map();
  async function dirMap(driveId, parentId, refresh = false) {
    const k = `${driveId}/${parentId}`;
    const hit = dirMaps.get(k);
    if (hit?.p) return hit.p;
    if (!refresh && hit && Date.now() - hit.ts < LIST_TTL) return hit.map;
    const p = (async () => {
      const map = new Map();
      let token = "", pages = 0;
      // WPS children 顺序翻页，500/页；data/ 靠分片目录把每页控制在小范围（见 listData）
      // 注意：一页全是目录时（page_size=500）WPS 只回 256 条且不给 next_page_token；
      // data/ 正好 256 个分片所以安全，分片数超过 256 会静默漏列。
      // shortcut: 顺序翻页不并发；实测列举成为瓶颈时再按页预取
      do {
        const d = await wps.children(driveId, parentId, token);
        for (const f of d.items ?? []) map.set(f.name, f);
        token = d.next_page_token ?? "";
      } while (token && ++pages < MAX_PAGES);
      return map;
    })();
    dirMaps.set(k, { p });
    try {
      const map = await p;
      dirMaps.set(k, { map, ts: Date.now() });
      return map;
    } catch (e) {
      dirMaps.delete(k);
      throw e;
    }
  }

  // cached=true：不刷新，用于「写入前判断是否已存在」（本进程的写入都会同步进 map）
  // 默认：命中不了就整目录重列一次，用于读/删外部可能新增的对象
  async function childByName(driveId, parentId, name, { cached = false } = {}) {
    const map = await dirMap(driveId, parentId);
    const hit = map.get(name);
    if (hit || cached) return hit;
    return (await dirMap(driveId, parentId, true)).get(name);
  }

  // 允许多级 repo 路径：/rest/<bucket>/backups/restic/ → ["backups","restic"]
  async function resolveDir(driveId, parts, create) {
    let parentId = "0";
    for (const name of parts) {
      let node = await childByName(driveId, parentId, name, { cached: create });
      if (!node && create) {
        node = await wps.createFolder(driveId, parentId, name);
        dirMaps.delete(`${driveId}/${parentId}`); // 新目录会改变父目录内容
      }
      if (!node) return null;
      parentId = node.id;
    }
    return parentId;
  }

  // ── 上传：先落临时文件并算 sha256，再把 size+hash 交给 WPS 申请直传 ──
  let active = 0;
  const waiting = [];
  async function acquire() {
    if (active < uploadConcurrency) { active++; return; }
    await new Promise((r) => waiting.push(r));
  }
  function release() {
    active--;
    waiting.shift()?.();
  }

  async function spool(req) {
    const tmp = path.join(os.tmpdir(), `wps365-rest-${crypto.randomUUID()}`);
    const hash = crypto.createHash("sha256");
    const tap = new Transform({
      transform(chunk, _enc, cb) { hash.update(chunk); cb(null, chunk); },
    });
    try {
      await pipeline(req, tap, fs.createWriteStream(tmp));
    } catch (e) {
      fs.rm(tmp, { force: true }, () => {});
      throw e;
    }
    return { tmp, size: fs.statSync(tmp).size, sha256: hash.digest("hex") };
  }

  async function saveBlob(driveId, parentId, name, req) {
    await acquire();
    let tmp;
    try {
      // 落盘时顺手算 sha256：WPS 申请直传必须要 size + 整体 sha256，
      // 且 restic 的对象名就是 sha256，可在此校验传输完整性。
      const s = await spool(req);
      tmp = s.tmp;
      const declared = Number(req.headers["content-length"]);
      if (Number.isFinite(declared) && declared !== s.size) {
        const e = new Error(`content-length ${declared} != ${s.size}`);
        e.status = 400; throw e;
      }
      if (name !== "config" && s.sha256 !== name) {
        const e = new Error("file content does not match hash");
        e.status = 400; throw e;
      }
      const { upload_id, store_request } = await wps.requestUploadHashed(driveId, parentId, name, s.size, s.sha256);
      await wps.uploadStoreHashed(store_request, tmp, s.size, s.sha256);
      const commit = await wps.commitUpload(driveId, parentId, upload_id);

      // 写后直接更新缓存：WPS children 有最终一致窗口，restic 紧接着的 HEAD 必须命中
      const map = await dirMap(driveId, parentId);
      map.set(name, {
        id: commit?.id ?? upload_id, name, type: "file", size: s.size,
        mtime: commit?.mtime, hash: { sum: s.sha256 },
      });
      return s;
    } finally {
      if (tmp) fs.rm(tmp, { force: true }, () => {});
      release();
    }
  }

  // rest-server 的布局：data 按 sha 前两位分片（data/ab/abcdef...），其余类型平铺。
  // REST 的 URL 始终是平的（/data/<hex>），分片只是服务端实现细节。
  // 这样同一个仓库既能用 S3 访问也能用 REST 访问。
  const blobParts = (repo, type, id) => [...repo, ...(type === "data" ? [type, id.slice(0, 2)] : [type])];

  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  // 列举 data/：先拿 256 个分片目录，再并发拉每个分片里的 pack
  async function listData(driveId, repo) {
    const dataId = await resolveDir(driveId, [...repo, "data"], false);
    if (!dataId) return null;
    const shards = [...(await dirMap(driveId, dataId)).values()].filter((f) => f.type === "folder");
    const lists = await mapLimit(shards, SHARD_CONCURRENCY, async (shard) => {
      const m = await dirMap(driveId, shard.id);
      return [...m.values()].filter((f) => f.type !== "folder").map((f) => ({ name: f.name, size: f.size ?? 0 }));
    });
    return lists.flat();
  }

  // 末段是 config / 类型目录 / 类型目录下的 64 位 hex；其余是 repo 路径（首段是 bucket）
  function parse(req) {
    let segs;
    try {
      // 仓库目录名可能是中文（WPS 网盘很常见），路径段要解码；%2F 解码出斜杠则视为非法
      segs = req.path.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return { kind: "bad" };
    }
    if (segs.some((s) => !s || s.includes("/") || s === "." || s === "..")) return { kind: "bad" };
    if (segs.length === 0) return { kind: req.query.create === "true" ? "create" : "bad" };
    const bucket = buckets.find((b) => b.name === segs[0]);
    if (!bucket) return { kind: "nobucket" };
    const rest = segs.slice(1);
    if (req.query.create === "true" && req.method === "POST") return { kind: "create", bucket, repo: rest };
    if (rest.at(-1) === "config") return { kind: "config", bucket, repo: rest.slice(0, -1) };
    if (TYPES.has(rest.at(-1))) return { kind: "list", bucket, type: rest.at(-1), repo: rest.slice(0, -1) };
    if (rest.length >= 2 && TYPES.has(rest.at(-2)) && HEX64.test(rest.at(-1))) {
      return { kind: "blob", bucket, type: rest.at(-2), id: rest.at(-1), repo: rest.slice(0, -2) };
    }
    return { kind: "bad" };
  }

  app.all("*", async (req, res) => {
    try {
      const r = parse(req);
      if (r.kind === "nobucket" || r.kind === "bad") return res.status(404).type("text/plain").send("not found");
      const { bucket } = r;

      if (r.kind === "create") {
        if (readOnly) return res.status(403).type("text/plain").send("read-only");
        if (req.method !== "POST") return res.status(405).end();
        const repoId = await resolveDir(bucket.driveId, r.repo, true);
        for (const t of TYPES) await resolveDir(bucket.driveId, [...r.repo, t], true);
        if (!repoId) return res.status(500).end();
        return res.status(200).end();
      }

      const repoId = await resolveDir(bucket.driveId, r.repo, false);
      // 仓库不存在：列表返回 404（restic 容忍），config 也是 404
      if (!repoId) {
        if (r.kind === "list" || r.kind === "config") return res.status(404).type("text/plain").send("repository does not exist");
        return res.status(404).end();
      }

      if (r.kind === "config") {
        // 写前查重用缓存（不刷新）：本进程写入即更新缓存，刷新只用于读路径上的外部改动
        const node = await childByName(bucket.driveId, repoId, "config", { cached: req.method === "POST" });
        if (req.method === "HEAD") {
          if (!node) return res.status(404).end();
          return res.status(200).set("Content-Length", String(node.size ?? 0)).end();
        }
        if (req.method === "GET") {
          if (!node) return res.status(404).end();
          return await proxyGet(req, res, bucket.driveId, node);
        }
        if (req.method === "POST") {
          if (node) return res.status(403).type("text/plain").send("config already exists");
          if (readOnly) return res.status(403).type("text/plain").send("read-only");
          await saveBlob(bucket.driveId, repoId, "config", req);
          return res.status(200).end();
        }
        if (req.method === "DELETE") {
          if (readOnly) return res.status(403).type("text/plain").send("read-only");
          if (node) {
            await wps.deleteFile(bucket.driveId, node.id);
            (await dirMap(bucket.driveId, repoId)).delete("config");
          }
          return res.status(200).end(); // 幂等
        }
        return res.status(405).end();
      }

      if (r.kind === "list") {
        if (req.method !== "GET") return res.status(405).end();
        if (r.type === "data") {
          const items = await listData(bucket.driveId, r.repo);
          if (!items) return res.status(404).type("text/plain").send("no such type dir");
          const v2 = (req.headers.accept ?? "").includes("restic.rest.v2");
          res.status(200).set("Content-Type", v2 ? V2 : V1);
          return res.end(JSON.stringify(v2 ? items : items.map((i) => i.name)));
        }
        const typeId = await resolveDir(bucket.driveId, [...r.repo, r.type], false);
        if (!typeId) return res.status(404).type("text/plain").send("no such type dir");
        const items = [...(await dirMap(bucket.driveId, typeId)).values()]
          .filter((f) => f.type !== "folder")
          .map((f) => ({ name: f.name, size: f.size ?? 0 }));
        const v2 = (req.headers.accept ?? "").includes("restic.rest.v2");
        // 用 end 而不是 send：express 会给字符串自动补 charset，而 restic 是
        // 精确比较 Content-Type 来决定按 v1 还是 v2 列举。
        res.status(200).set("Content-Type", v2 ? V2 : V1);
        return res.end(JSON.stringify(v2 ? items : items.map((i) => i.name)));
      }

      // kind === "blob"：POST 时按需建分片目录
      const dirId = await resolveDir(bucket.driveId, blobParts(r.repo, r.type, r.id), req.method === "POST");
      const node = dirId
        ? await childByName(bucket.driveId, dirId, r.id, { cached: req.method === "POST" })
        : null;
      if (req.method === "HEAD") {
        if (!node) return res.status(404).end();
        return res.status(200).set("Content-Length", String(node.size ?? 0)).end();
      }
      if (req.method === "GET") {
        if (!node) return res.status(404).end();
        return await proxyGet(req, res, bucket.driveId, node);
      }
      if (req.method === "POST") {
        if (!dirId) return res.status(404).end();
        if (node) return res.status(403).type("text/plain").send("blob already exists");
        if (readOnly) return res.status(403).type("text/plain").send("read-only");
        await saveBlob(bucket.driveId, dirId, r.id, req);
        return res.status(200).end();
      }
      if (req.method === "DELETE") {
        // append-only：只允许删锁，其余拒（restic unlock 需要）
        if (readOnly && r.type !== "locks") return res.status(403).type("text/plain").send("read-only");
        if (node) {
          await wps.deleteFile(bucket.driveId, node.id);
          (await dirMap(bucket.driveId, dirId)).delete(r.id);
        }
        return res.status(200).end(); // 幂等
      }
      return res.status(405).end();
    } catch (e) {
      console.error("[rest]", e.message);
      res.status(e.status ?? 500).type("text/plain").send(e.message);
    }
  });

  // 下载代理：WPS 直链要 Bearer，客户端跟随 302 会丢凭据；Range 原样透传
  async function proxyGet(req, res, driveId, node) {
    const url = await wps.downloadUrl(driveId, node.id);
    const headers = { Authorization: `Bearer ${wps.accessToken}` };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(url, { headers, redirect: "follow" });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).type("text/plain").send(`download failed: ${upstream.status}`);
    }
    res.status(upstream.status);
    for (const h of ["content-range", "accept-ranges", "content-length", "content-type", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) res.set(h, v);
    }
    if (!res.get("Content-Type")) res.set("Content-Type", "application/octet-stream");
    const down = Readable.fromWeb(upstream.body);
    // 用 pipeline：客户端中途断开或 WPS 传输中断时能正常收尾，不让 error 逃逸成未捕获异常
    const out = wps.downloadBucket ? down.pipe(throttleStream(wps.downloadBucket)) : down;
    await pipeline(out, res).catch(() => {});
  }

  return app;
}
