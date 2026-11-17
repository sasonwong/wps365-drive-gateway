# WPS365 Drive Gateway

把 WPS 365 云文档（个人盘 + 团队文档库）暴露为标准 **S3 协议** endpoint。任何 S3 客户端（aws cli、boto3、rclone、s3cmd、MinIO Client…）都可以像用 S3 一样读写你的 WPS 云盘。

## 特性

- ✅ S3 兼容：`ListBuckets` / `ListObjectsV2` / `ListObjects`(V1) / `GetObject`(Range) / `PutObject` / `DeleteObject` / `HeadObject` / `CopyObject` / `GetBucketLocation` / **Multipart Upload**（Create/UploadPart/Complete/Abort + ListParts/ListMultipartUploads）
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

# 同步时加 --size-only：增量对比按大小（WPS mtime 是秒级上传时刻，备份场景推荐）
# 注意：size_only 不支持写在 rclone.conf 里（rclone 1.71 静默忽略），必须用命令行 flag 或 RCLONE_SIZE_ONLY=true
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

## 本机常驻（systemd 用户服务）

```bash
# unit 里的 node 走 ~/.local/bin/node 软链，避免把特定 node 版本写进仓库
mkdir -p ~/.local/bin && ln -sfn "$(command -v node)" ~/.local/bin/node
ln -sfn "$PWD/deploy/wps365-drive-gateway.service" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now wps365-drive-gateway
```

- 日志与首次授权链接：`journalctl --user -u wps365-drive-gateway -f`
- 配置与登录态：仓库根的 `config.json` / `tokens.json`，不随 unit 走
- 开机自启需要 `loginctl enable-linger $USER`
- 升级 node 后重跑上面的 `ln -sfn "$(command -v node)" ~/.local/bin/node`

## 配置

见 [docs/DESIGN.md §8](docs/DESIGN.md) 与 `config.example.json`。关键项：

| 字段 | 说明 |
|------|------|
| `s3Credentials` | 网关对外签发的 S3 AK/SK 列表 |
| `wps.clientId / clientSecret` | WPS365 开发者后台应用凭证 |
| `wps.kso1Sign` | 是否启用 KSO-1 请求签名（后台「接口签名」开着则必须 true） |
| `buckets` | bucket 名 → WPS drive_id 映射（个人盘/团队文档库均可） |
| `readOnly` | true 时拒绝写操作 |
| `listConcurrency` | 递归列举时并发拉取子目录的数量，默认 16。调大可加速大仓库列举（如 rustic/restic 的 pack 列表），过高会撞 WPS 限流 |
| `cacheTtlMs` | 目录列表缓存时长，默认 30000（30s）。网关自身的写操作会立即失效缓存，只有外部（网页端/客户端）改动要等 TTL 生效 |

## 安全说明

- 默认只监听 `127.0.0.1`。公网暴露请自行加 TLS 与 IP 白名单
- 删除操作走 WPS 回收站，可在网盘里恢复
- `tokens.json`（refresh_token）权限 600，请勿提交到 git
- 完整威胁模型见 [docs/DESIGN.md §5](docs/DESIGN.md)

## 目录语义与空目录策略

WPS 的"文件夹"是真实实体，S3 协议没有目录对象，两者差异通过以下机制弥合：

- **删除后自动清理空目录**（默认开启）：删除对象后，若父目录变空则级联删除（`rclone purge` 后不留空文件夹）。设置 `"pruneEmptyDirs": false` 可关闭——关闭后删除文件不会删目录，可保留手动创建的空目录结构。
- **创建文件夹**：PUT 以 `/` 结尾的 key（S3 directory marker，如 `aws s3api put-object --key "dir/"`）；rclone 需在配置中加 `directory_markers = true` 后 `mkdir` 才生效。
- **rclone 注意**：`rmdir`/`rmdirs` 对 S3 后端是 no-op（rclone 设计如此，不发请求）；删空目录请用网关（`DELETE dir/`）或关掉 prune 后用 purge + 手动清理。HEAD 目录 key 无尾斜杠返回 404、带尾斜杠返回 200（`application/directory`），与 rclone 1.71 的判定逻辑对齐。

## 设计文档

[docs/DESIGN.md](docs/DESIGN.md) — 架构、映射、鉴权、API 依赖清单、功能取舍。
[docs/sync-notes.md](docs/sync-notes.md) — rclone sync 联调记录（覆盖语义/mtime/多部分上传坑）。

## License

MIT

