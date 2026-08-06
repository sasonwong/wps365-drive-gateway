# rclone sync 实测记录（8.3GB / 3727 文件）

> 开发过程笔记：问题、根因与验证结果。读者对象是后续维护者。

## 结论

- 全量同步 3725/3727 成功，收敛后增量 sync **0 传输**（秒级）
- 已知限制：WPS 云盘不支持**点号开头**文件名（`.stignore`、`.DS_Store` 等），返回 400 `文件名为空`。同步时用 `--filter "- .*"` 排除，或接受错误（`--ignore-errors`）

## 三个连环根因（sync 反复全量重传）

### 1. `on_name_conflict: "rename"` 破坏 S3 覆盖语义

- 症状：rclone `Copied (replaced existing)` 死循环，远端堆出 8000+ 个 `(N)` 孤儿文件
- 机制：S3 PUT 是覆盖（upsert）。网关用 `rename` 后，每次覆盖都新建 `(N)` 文件，**原 key 永远不存在** → rclone HEAD 404 → 下轮又传 → 又 rename
- 修复：`requestUpload` / `multipartCreate` 的 `on_name_conflict: "overwrite"`
- 附带修复：PUT `dir/`（directory marker）幂等——目录已存在不重复创建（createFolder 的 rename 会生成 `(1)` 目录）

### 2. `X-Amz-Meta-Mtime` 浮点精度截断

- 症状：小文件（<200MB）也反复重传
- 机制：rclone 的 mtime 是纳秒精度字符串（`1785540000.123456789`，19 位有效数字），JS `parseFloat` 超双精度截断（变 `.1234567`）→ HEAD 回传的 mtime ≠ 原始 → 对比永远不一致
- 修复：**字符串原样存取**、原样回传 `X-Amz-Meta-Mtime` 响应头（Last-Modified 只是 fallback，rclone 优先读 meta 头）

### 3. multipart 的 mtime 盲区

- 症状：>200MB 文件（`--s3-upload-cutoff` 默认 200MB）持续重传
- 机制：rclone 走 multipart 时 metadata（含 mtime）只在 **CreateMultipartUpload** 请求带，**Complete 请求不带** → Complete 分支读不到
- 修复：Create 时把 `x-amz-meta-mtime` 存入 mpu 会话，Complete 时取出

## mtime 持久化

mtime 表是**内存 + 落盘**（`<tokenFile 同目录>/mtime.json`，debounce 2s 写盘，启动时加载）：

- 网关重启后 mtime 记录仍在 → 增量 sync 不受影响
- `mtime.json` 已 gitignore（含 key 路径，算隐私数据）

## 验证轮次

| 轮次 | 结果 |
|------|------|
| sync1-3（旧逻辑） | replaced 循环 + 8000 孤儿，网关重启多次 |
| sync4（overwrite+seedCache） | 全量成功，孤儿被删除阶段清理 |
| sync6（overwrite 生效） | 3725 覆盖上传，Deleted 0（不再产孤儿） |
| sync9（mtime 字符串+multipart 修复） | 全量 3725，Deleted 0 |
| sync10 | **0 传输** ✅ 收敛 |
| 重启网关后 | mtime.json 加载，HEAD 原样回传 ✅ |

## 其他关联修复

- **seedCache**：PUT/Complete 后把新文件注入目录缓存（WPS children 最终一致延迟，并发写时 HEAD 验证会 404）
- **HEAD 404 重试**：近期上传过的 key 404 时延迟 700ms 重查（消除最终一致窗口）
- **删除竞态**：rclone 删除阶段偶发 404（孤儿已被前批删掉），无害
