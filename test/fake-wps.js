// 测试用 fake WPS：内存目录树 + 分页 children + 直链下载（支持 Range）。
// 分页故意很小，用来证明 REST 层的列举真的会翻完所有页。
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";

export const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

export function makeFakeWps({ pageSize = 3 } = {}) {
  const dirs = new Map([["0", new Map()]]);
  const blobs = new Map();     // fileId → Buffer
  const pending = new Map();   // uploadId → 元数据
  let seq = 1;
  let port = 0;
  const calls = { children: 0, uploads: 0, downloads: 0 };

  const downloadSrv = http.createServer((req, res) => {
    calls.downloads++;
    const buf = blobs.get(req.url.slice(1));
    if (!buf) return res.writeHead(404).end();
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    if (!m) return res.writeHead(200, { "Content-Length": buf.length }).end(buf);
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : buf.length - 1;
    const part = buf.subarray(a, b + 1);
    res.writeHead(206, {
      "Content-Range": `bytes ${a}-${b}/${buf.length}`,
      "Content-Length": part.length,
      "Accept-Ranges": "bytes",
    }).end(part);
  });

  const wps = {
    accessToken: "test-token",
    async children(_driveId, parentId, token) {
      calls.children++;
      const all = [...(dirs.get(parentId) ?? new Map()).values()];
      const start = Number(token || 0);
      const next = start + pageSize < all.length ? String(start + pageSize) : "";
      return { items: all.slice(start, start + pageSize), next_page_token: next };
    },
    async createFolder(_driveId, parentId, name) {
      const node = { id: `dir-${seq++}`, name, type: "folder" };
      dirs.get(parentId).set(name, node);
      dirs.set(node.id, new Map());
      return node;
    },
    async requestUploadHashed(_driveId, parentId, name, size, sum) {
      calls.uploads++;
      const upload_id = `blob-${seq++}`;
      pending.set(upload_id, { parentId, name, size, sum });
      return { upload_id, store_request: { url: `http://127.0.0.1:1/${upload_id}`, method: "PUT" } };
    },
    async uploadStoreHashed(storeRequest, filePath, _size, _sum) {
      pending.get(storeRequest.url.split("/").pop()).body = fs.readFileSync(filePath);
    },
    async commitUpload(_driveId, parentId, uploadId) {
      const rec = pending.get(uploadId);
      const node = { id: uploadId, name: rec.name, type: "file", size: rec.body.length };
      dirs.get(parentId).set(rec.name, node);
      blobs.set(uploadId, rec.body);
      pending.delete(uploadId);
      return node;
    },
    async deleteFile(_driveId, fileId) {
      blobs.delete(fileId);
      for (const m of dirs.values()) for (const [k, v] of m) if (v.id === fileId) m.delete(k);
    },
    async downloadUrl(_driveId, fileId) {
      return `http://127.0.0.1:${port}/${fileId}`;
    },
  };

  return {
    wps, dirs, blobs, calls,
    // 翻完所有页（测试断言用）
    async allChildren(parentId, driveId = "drive-1") {
      const out = [];
      let token = "";
      do {
        const d = await wps.children(driveId, parentId, token);
        out.push(...d.items);
        token = d.next_page_token;
      } while (token);
      return out;
    },
    async listen() {
      await new Promise((r) => downloadSrv.listen(0, "127.0.0.1", r));
      port = downloadSrv.address().port;
    },
    async close() {
      downloadSrv.closeAllConnections();
      await new Promise((r) => downloadSrv.close(r));
    },
  };
}
