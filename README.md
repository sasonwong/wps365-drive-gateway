# WPS365 Drive Gateway

把 WPS 365 云文档（个人盘 + 团队文档库）暴露为标准 **S3 协议** endpoint。任何 S3 客户端（aws cli、boto3、rclone、s3cmd、MinIO Client…）都可以像用 S3 一样读写你的 WPS 云盘。

## 特性

- ✅ S3 兼容：`ListBuckets` / `ListObjectsV2` / `GetObject`(Range) / `PutObject` / `DeleteObject` / `HeadObject` / `CopyObject` / **Multipart Upload**
- ✅ 个人盘 + 团队文档库（`/v7/doclibs`）
- ✅ AWS Signature V4 鉴权（静态 AK/SK，标准 S3 SDK 零改造接入）
- ✅ 支持 WPS 侧 **KSO-1 签名**（开发者后台「接口签名」开启时也能用）
- ✅ delegated token 自动续期（refresh_token 长期有效，首次授权后无需人工干预）
- ✅ 删除进回收站、只读模式、多凭证
- ✅ 空目录自动清理（`pruneEmptyDirs` 可关）+ S3 directory marker（PUT `dir/` 建文件夹）
- ✅ 纯 Node.js（≥20），仅依赖 `express` + `aws4`

## 快速开始

```bash
git clone https://github.com/sasonwong/wps365-drive-gateway && cd wps365-drive-gateway
npm install
cp config.example.json config.json   # 填入你的 client_id / client_secret / bucket 映射
node src/index.js
```

首次启动会输出一个设备码授权链接，浏览器打开授权后即完成登录。之后 token 自动续期。

### 用 aws cli 验证

```bash
export AWS_ACCESS_KEY_ID=gateway-admin AWS_SECRET_ACCESS_KEY=change-me
aws --endpoint-url http://127.0.0.1:9000 s3 ls
aws --endpoint-url http://127.0.0.1:9000 s3 cp ./x.pdf s3://personal/归档/x.pdf
aws --endpoint-url http://127.0.0.1:9000 s3 cp s3://personal/归档/x.pdf ./
```

### 用 rclone

```ini
[wps]
type = s3
provider = Other
endpoint = http://127.0.0.1:9000
access_key_id = gateway-admin
secret_access_key = change-me
```

## Docker 部署

```bash
docker compose up -d --build
# 首次启动：从日志里拿设备码授权链接，浏览器打开完成登录
docker compose logs -f wps365-drive-gateway
```

- `config.json` 挂载为只读（不入镜像），按 `config.example.json` 准备
- `./data/tokens.json` 持久化登录态（refresh_token），重启不重新授权
- 映射端口/限制监听地址按需改 `docker-compose.yml`

## 配置

见 [docs/DESIGN.md §8](docs/DESIGN.md) 与 `config.example.json`。关键项：

| 字段 | 说明 |
|------|------|
| `s3Credentials` | 网关对外签发的 S3 AK/SK 列表 |
| `wps.clientId / clientSecret` | WPS365 开发者后台应用凭证 |
| `wps.kso1Sign` | 是否启用 KSO-1 请求签名（后台「接口签名」开着则必须 true） |
| `buckets` | bucket 名 → WPS drive_id 映射（个人盘/团队文档库均可） |
| `readOnly` | true 时拒绝写操作 |

## 安全说明

- 默认只监听 `127.0.0.1`。公网暴露请自行加 TLS 与 IP 白名单
- 删除操作走 WPS 回收站，可在网盘里恢复
- `tokens.json`（refresh_token）权限 600，请勿提交到 git
- 完整威胁模型见 [docs/DESIGN.md §5](docs/DESIGN.md)

## 目录语义与空目录策略

WPS 的"文件夹"是真实实体，S3 协议没有目录对象，两者差异通过以下机制弥合：

- **删除后自动清理空目录**（默认开启）：删除对象后，若父目录变空则级联删除（`rclone purge` 后不留空文件夹）。设置 `"pruneEmptyDirs": false` 可关闭——关闭后删除文件不会删目录，可保留手动创建的空目录结构。
- **创建文件夹**：PUT 以 `/` 结尾的 key（S3 directory marker，如 `aws s3api put-object --key "dir/"`）；rclone 需在配置中加 `directory_markers = true` 后 `mkdir` 才生效。
- **rclone 注意**：`rmdir`/`rmdirs` 对 S3 后端是 no-op（rclone 设计如此，不发请求）；删空目录请用网关（`DELETE dir/`）或关掉 prune 后用 purge + 手动清理。HEAD 目录 key 无尾斜杠返回 404、带尾斜杠返回 200（`application/directory`），与 rclone 的判定逻辑对齐。

## 设计文档

[docs/DESIGN.md](docs/DESIGN.md) — 架构、映射、鉴权、API 依赖清单、功能取舍。

## License

MIT

## rclone sync 实测

**核心语义修正**（sync 反复重传的 3 个连环根因）：

1. **`on_name_conflict: "overwrite"`**：S3 PUT 是覆盖语义。原用 `rename` 导致每次覆盖都变成新建 `(N)` 文件 → 原 key 永远不存在 → rclone 死循环重传 + 大量孤儿文件。已改 overwrite。
2. **`X-Amz-Meta-Mtime` 字符串原样存取**：rclone 的 mtime 是纳秒精度（如 `1785540000.123456789`），JS `parseFloat` 会截断（19 位有效数字超双精度）→ 对比永远不一致。网关必须字符串原样保存、原样回传。
3. **multipart 的 mtime 在 CreateMultipartUpload 请求里**（rclone 对 >200MB 文件走 multipart，Complete 请求不带 metadata）→ Create 时存入会话。

**验证结果**（连续 10 轮 sync 实测）：
- 首轮全量：全部成功（个别点号开头文件被 WPS 拒绝，见下）
- 收敛后增量：**0 传输**（秒级完成）
- 孤儿文件（`(N)` 变体）：overwrite 后不再产生

**已知限制**：WPS 云盘不支持**点号开头**的文件名（`.stignore`、`.DS_Store` 等），返回 400。同步此类目录时用 `--filter "- .*"` 排除，或接受这 2 个错误（`--ignore-errors`）。
