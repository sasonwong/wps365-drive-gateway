# rclone sync 实测记录

> 开发过程笔记：问题、根因与验证结果。读者对象是后续维护者。
> restic / rustic 的 REST 端点实测见 [restic-notes.md](restic-notes.md)。

## 结论

- 全量同步成功，收敛后增量 sync **0 传输**（秒级）
- 已知限制：WPS 云盘不支持**点号开头**文件名（`.stignore`、`.DS_Store` 等），返回 400 `文件名为空`。同步时用 `--filter "- .*"` 排除，或接受错误（`--ignore-errors`）

## 三个连环根因（sync 反复全量重传）

### 1. `on_name_conflict: "rename"` 破坏 S3 覆盖语义

- 症状：rclone `Copied (replaced existing)` 死循环，远端堆出大批 `(N)` 孤儿文件
- 机制：S3 PUT 是覆盖（upsert）。网关用 `rename` 后，每次覆盖都新建 `(N)` 文件，**原 key 永远不存在** → rclone HEAD 404 → 下轮又传 → 又 rename
- 修复：`requestUpload` / `multipartCreate` 的 `on_name_conflict: "overwrite"`
- 附带修复：PUT `dir/`（directory marker）幂等——目录已存在不重复创建（createFolder 的 rename 会生成 `(1)` 目录）

### 2. `X-Amz-Meta-Mtime` 浮点精度截断（机制已废弃）

- 历史：曾用 `X-Amz-Meta-Mtime` 回传纳秒精度 mtime（rclone 优先读它），踩过 JS `parseFloat` 双精度截断（19 位有效数字）导致对比永不相等 → 字符串原样存取修复
- **已废弃**：WPS API 没有设置 mtime 的能力（`request_upload`/multipart 均无 modified_time 参数），mtime 表是第三份状态（路径 key、删除不清理、外部渠道修改后 rclone 看不到）。整个机制已删除，见下方现役策略

### 3. multipart 的 mtime 盲区（随机制一起废弃）

- 历史：rclone 走 multipart 时 metadata 只在 CreateMultipartUpload 带，Complete 不带 → Complete 分支读不到
- 随 §2 机制删除而废弃

## mtime 策略（现役）

- WPS 原生 `mtime`（秒级）= S3 `Last-Modified`，无任何自维护状态，外部渠道的修改天然可见
- rclone 同步加 **`--size-only`**：增量按大小对比，不依赖 mtime（备份场景标准做法）
- 注意：`size_only = true` **写不进 rclone.conf**（实测静默忽略），必须命令行 flag 或环境变量 `RCLONE_SIZE_ONLY=true`
- 代价：上传文件 mtime = 上传时刻（非源时间）；同大小内容修改不重传。restic append-only repo 不受影响（按内容哈希去重）

## 验证轮次

| 轮次 | 结果 |
|------|------|
| sync1-3（旧逻辑） | replaced 循环 + 大量孤儿，网关重启多次 |
| sync4（overwrite+seedCache） | 全量成功，孤儿被删除阶段清理 |
| sync6（overwrite 生效） | 全量覆盖上传，Deleted 0（不再产孤儿） |
| sync9（mtime 字符串+multipart 修复） | 全量成功，Deleted 0 |
| sync10 | **0 传输** ✅ 收敛 |
| 重启网关后 | mtime.json 加载，HEAD 原样回传 ✅ |

> 上述 sync9/sync10/重启行是 `X-Amz-Meta-Mtime` 机制时期的验证；机制移除后（size_only 方案）增量 sync 按大小对比收敛，语义见「mtime 策略」

## 其他关联修复

- **seedCache**：PUT/Complete 后把新文件注入目录缓存（WPS children 最终一致延迟，并发写时 HEAD 验证会 404）
- **HEAD 404 重试**：近期上传过的 key 404 时延迟 700ms 重查（消除最终一致窗口）
- **删除竞态**：rclone 删除阶段偶发 404（孤儿已被前批删掉），无害
