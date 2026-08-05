# WPS365 Drive Gateway

把 WPS 365 云文档（个人盘 + 团队文档库）暴露为标准 **S3 协议** endpoint。任何 S3 客户端（aws cli、boto3、rclone、s3cmd、MinIO Client…）都可以像用 S3 一样读写你的 WPS 云盘。

## 特性

- ✅ S3 兼容：`ListBuckets` / `ListObjectsV2` / `GetObject` / `PutObject` / `DeleteObject` / `HeadObject`
- ✅ 个人盘 + 团队文档库（`/v7/doclibs`）
- ✅ AWS Signature V4 鉴权（静态 AK/SK，标准 S3 SDK 零改造接入）
- ✅ 支持 WPS 侧 **KSO-1 签名**（开发者后台「接口签名」开启时也能用）
- ✅ delegated token 自动续期（首次授权后无需人工干预）
- ✅ 删除进回收站、只读模式、多凭证
- ✅ 纯 Node.js（≥20），仅依赖 `express` + `aws4`

## 快速开始

```bash
git clone <repo-url> && cd wps365-drive-gateway
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

## 设计文档

[docs/DESIGN.md](docs/DESIGN.md) — 架构、映射、鉴权、API 依赖清单、功能取舍。

## License

MIT
