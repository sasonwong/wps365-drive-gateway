// 路径级 append-only：列出的前缀下只允许新增，不允许删除。
// 冷仓用它替代客户端的 delete-never —— 客户端配错 forget --prune 也删不掉。
// 条目形如 "/<bucket>/<仓库路径>"（bucket 名 + 仓库路径）。
export function makeAppendOnly(paths = []) {
  const list = paths.map((p) => p.replace(/^\/+|\/+$/g, ""));
  return (bucketName, key = "") => {
    const full = `${bucketName}/${key}`.replace(/\/+/g, "/").replace(/\/+$/, "");
    return list.some((p) => full === p || full.startsWith(`${p}/`));
  };
}
