// bucket 发现与合并：显式配置优先，autoBuckets 时把未配置的盘按 id 派生名字补进来。
// 名字从 id 派生而不是盘名：S3 bucket 只允许小写字母数字和 . -，中文盘名要百分号编码；
// 而且盘名会改、id 不会——仓库路径依赖 bucket 名，名字一变历史快照就"丢"了。
export function nameFor(kind, id) {
  return `${kind}-${String(id).toLowerCase()}`;
}

export function mergeBuckets(configured, { drives = [], doclibs = [] }, auto = false) {
  const byId = new Set(configured.map((b) => b.driveId));
  const taken = new Set(configured.map((b) => b.name));
  const added = [];
  if (auto) {
    for (const [kind, list] of [["user", drives], ["doclib", doclibs]]) {
      for (const d of list ?? []) {
        if (!d?.id || byId.has(d.id)) continue;
        let name = nameFor(kind, d.id);
        while (taken.has(name)) name += "x";
        taken.add(name);
        byId.add(d.id);
        added.push({ name, driveId: d.id });
      }
    }
  }
  return { buckets: [...configured, ...added], added };
}

// 配置了但当前账号看不到的盘（授权被撤/删了），启动时告警用
export function missingBuckets(configured, { drives = [], doclibs = [] }) {
  const known = new Set([...(drives ?? []).map((d) => d.id), ...(doclibs ?? []).map((d) => d.id)]);
  return configured.filter((b) => !known.has(b.driveId));
}
