# WPS365 Drive Gateway — 设计方案

把 WPS 365 云文档（个人盘 + 团队文档库）暴露为标准 S3 协议 endpoint，任何 S3 SDK / aws cli / rclone / s3cmd 均可读写。

## 1. 目标

- 提供 S3 兼容 HTTP 接口：`ListBuckets` / `ListObjectsV2` / `GetObject` / `PutObject` / `DeleteObject` / `HeadObject`
- 后端对接 WPS 365 OpenAPI（`openapi.wps.cn`），不依赖 `wps365-cli`
- 支持 WPS 侧 **KSO-1 签名**（开发者后台「接口签名」开关开启时必需）
- 支持个人盘与团队文档库（`/v7/doclibs`）

## 2. 架构

```
S3 客户端 (aws cli / boto3 / rclone / minio client ...)
        │  AWS Signature V4 (静态 AK/SK)
        ▼
┌─────────────────────────────┐
│  网关 (Node.js + express)   │
│  ├─ SigV4 验证 (aws4)       │
│  ├─ S3 协议层 (XML 响应)    │
│  └─ WPS 适配层              │
└─────────────────────────────┘
        │  HTTPS + Bearer token + KSO-1 签名头
        ▼
   WPS 365 OpenAPI (openapi.wps.cn)
```

## 3. 映射关系

| S3 概念 | WPS 概念 | WPS API |
|---------|---------|---------|
| Bucket | 盘 / 团队文档库 | `GET /v7/drives?allotee_type=user`、`GET /v7/doclibs` |
| Object key（`a/b/c.pdf`） | 目录树 | `GET /v7/drives/{drive_id}/files/{parent_id}/children` |
| ListObjectsV2 | 列目录（前缀过滤在网关层做） | 同上 |
| PutObject | 三段式上传 | `POST .../files/{parent_id}/request_upload` → PUT 直传 URL → `POST .../files/{parent_id}/commit_upload` |
| GetObject | 下载 | `GET /v7/drives/{drive_id}/files/{file_id}/download` → 临时 URL |
| HeadObject | 文件元数据 | `GET /v7/drives/{drive_id}/files/{file_id}/meta` |
| DeleteObject | 删除（进回收站） | `POST /v7/drives/{drive_id}/files/{file_id}/delete` |

**Bucket 与盘的绑定**：网关配置文件静态声明 `bucket name → drive_id`。个人盘与团队文档库的 drive_id 均可绑定。

## 4. 鉴权设计（三层）

### 4.1 S3 客户端 → 网关：AWS Signature V4

- 网关静态签发一对 `AccessKey/SecretKey`（配置在 `s3Credentials`，可多对、可轮换）
- 用 `aws4` 库校验请求签名（V4，`us-east-1` / `s3`），非法签名返回 `403 InvalidAccessKeyId` / `SignatureDoesNotMatch`
- 支持任意标准 S3 SDK，客户端零改造

### 4.2 网关 → WPS：OAuth2 delegated token

- **首次**：设备码流程（`POST /oauth2/device/authorize`），用户浏览器授权，拿到 refresh_token 落盘（`tokens.json`，权限 600）
- **日常**：网关自动用 refresh_token 续期 access_token（2h 过期），无需人工干预
- client_id / client_secret 存配置文件，日志中脱敏

### 4.3 网关 → WPS：KSO-1 请求签名（可开关）

开发者后台「接口签名」开启时，所有 kso 域请求需带：

```
X-Kso-Date: <RFC1123 GMT>
X-Kso-Authorization: KSO-1 <accessKey>:<HMAC-SHA256>
```

签名内容：`"KSO-1" + Method + RequestURI + ContentType + X-Kso-Date + sha256hex(body)`

配置项 `wps.kso1Sign: true` 启用；关闭则只带 Bearer token。**注意**：CLI 0.3.1 不支持 KSO-1，因此开启签名后 wps365-cli 会不可用（`invalid sign`），但本网关不受影响。

## 5. 安全边界

| 措施 | 实现 |
|------|------|
| 只读模式 | `readOnly: true` 时拒绝 PUT/DELETE |
| 删除进回收站 | WPS 删除 API 本身即进回收站，可从 `/v7/deleted_files` 恢复 |
| 网络隔离 | 默认监听 `127.0.0.1`；公网暴露需自行加 TLS 与白名单 |
| 凭证保护 | secret/refresh_token 不落日志；`tokens.json` chmod 600 |
| Bucket 白名单 | 只暴露配置中声明的 drive |

## 6. 功能取舍（第一版）

**实现**：ListBuckets / ListObjectsV2（prefix + delimiter + continuation-token）/ GetObject（流式转发）/ PutObject（流式上传）/ DeleteObject / HeadObject / KSO-1 签名 / token 自动续期 / 只读模式 / 多 S3 凭证。

**不做（后续按需加）**：
- Multipart upload（`CreateMultipartUpload` 等）——WPS 侧需确认分片 API 语义后再做
- CopyObject、GetBucketLocation 等次要操作
- ACL / 策略 / 版本控制 / 标签
- 大目录分页的深度缓存——第一版逐级实时查询，路径 → ID 用 TTL 内存缓存

## 7. WPS API 依赖清单

| 用途 | 端点 | scope |
|------|------|-------|
| 设备码授权 | `POST /oauth2/device/authorize` + `POST /oauth2/token` | 按登录 scopes |
| token 刷新 | `POST /oauth2/token` (grant_type=refresh_token) | — |
| 个人盘 | `GET /v7/drives?allotee_type=user` | kso.drive.readwrite |
| 团队文档库 | `GET /v7/doclibs` | kso.doclib.read |
| 列目录 | `GET /v7/drives/{id}/files/{pid}/children` | kso.file.read |
| 元数据 | `GET /v7/drives/{id}/files/{fid}/meta` | kso.file.read |
| 下载 | `GET /v7/drives/{id}/files/{fid}/download` | kso.file.read |
| 上传 | `POST .../request_upload` + `POST .../commit_upload` | kso.file.readwrite |
| 删除 | `POST /v7/drives/{id}/files/{fid}/delete` | kso.file.readwrite |

### 联调踩坑记录（重要）

1. **KSO-1 签名空 body 语义**：`sha256(RequestBody)` 在 body 为空时是**空字符串**，不是空串的 SHA256 哈希（官方 Python 示例语义）。
2. **签名内容必须用序列化后的 body**：签名中的 `sha256(body)` 是对实际发送的 `JSON.stringify(body)` 计算，不是 JS 对象。
3. **上传实体文件强制 KSO-1 + Bearer**：`request_upload` 返回的存储 URL（`*.wps.cn` 域）上传时**必须同时带** KSO-1 签名头和 `Authorization: Bearer`（申请接口的登录凭据），否则 `403 userNotLogin`。与后台「接口签名」开关无关。
4. **公网 `request_upload` 必传 `hashes`**（md5/sha256 至少一种），否则 400。
5. **`on_name_conflict` 是字符串**枚举（`rename`/`overwrite`/...），不是对象。
6. **「接口签名」开关关闭时**，kso 域接口只带 Bearer 即可；开启后全部 kso 域请求需 KSO-1 签名（CLI 0.3.1 不支持，会报 `invalid sign`）。

## 8. 配置示例

```jsonc
{
  "host": "127.0.0.1",
  "port": 9000,
  "s3Credentials": [
    { "accessKey": "gateway-admin", "secretKey": "change-me" }
  ],
  "wps": {
    "clientId": "AK...",
    "clientSecret": "sk...",
    "kso1Sign": false,
    "scopes": "kso.drive.readwrite,kso.file.readwrite,kso.doclib.read"
  },
  "buckets": [
    { "name": "personal",     "driveId": "dr_your_personal_drive" },
    { "name": "team-docs",    "driveId": "dr_your_team_drive" }
  ],
  "readOnly": false
}
```
