# WPS365 Drive Gateway — 设计方案

把 WPS 365 云文档（个人盘 + 团队文档库）暴露成 S3 与 restic REST 两种协议 endpoint：
S3 SDK / aws cli / rclone / s3cmd 可以像对象存储一样读写，restic / rustic 可以直接备份。
两条通道共用同一套 WPS 适配层和同一份目录树。

## 1. 目标

- 提供 S3 兼容 HTTP 接口：`ListBuckets` / `ListObjectsV2` / `GetObject` / `PutObject` / `DeleteObject` / `HeadObject`
- 提供 restic REST backend 接口（rest-server 兼容子集），restic / rustic 无需 rclone 中转
- 后端对接 WPS 365 OpenAPI（`openapi.wps.cn`），不依赖 `wps365-cli`
- 支持 WPS 侧 **KSO-1 签名**（开发者后台「接口签名」开关开启时必需）
- 支持个人盘与团队文档库（`/v7/doclibs`）

## 2. 架构

```
S3 客户端 (aws cli / rclone / s3cmd ...)      restic / rustic
        │ AWS SigV4 (静态 AK/SK)                 │ Basic (同一组 AK/SK)
        ▼                                        ▼
┌──────────────────────────────────────────────────────┐
│  网关 (Node.js + express)                            │
│  ├─ /rest     REST 协议层 (src/rest.js)              │
│  ├─ /*        S3 协议层 (src/s3.js, SigV4 + XML)     │
│  └─ WPS 适配层 (src/wps.js：token / KSO-1 / 上传 )    │
└──────────────────────────────────────────────────────┘
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

### 4.4 REST 客户端 → 网关：Basic 认证

restic 把用户名密码放在仓库 URL 里（`rest:http://user:pass@host/...`），每个请求都带 `Authorization: Basic`。
网关复用 `s3Credentials`：accessKey 当用户名、secretKey 当密码，没有单独的 REST 凭证配置。
明文传输，只监听 `127.0.0.1` 或自行加 TLS。

## 5. 安全边界

| 措施 | 实现 |
|------|------|
| 只读模式 | `readOnly: true` 时拒绝 S3 的 PUT/DELETE；REST 下拒绝建仓/上传，只放行删 `locks` |
| 删除进回收站 | WPS 删除 API 本身即进回收站，可从 `/v7/deleted_files` 恢复 |
| 网络隔离 | 默认监听 `127.0.0.1`；公网暴露需自行加 TLS 与白名单 |
| 凭证保护 | secret/refresh_token 不落日志；`tokens.json` chmod 600 |
| Bucket 白名单 | 只暴露配置中声明的 drive |

## 6. 功能取舍（第一版）

**实现**：ListBuckets / ListObjectsV2 + V1（prefix + delimiter + 分页）/ GetObject（流式转发 + Range）/ PutObject / DeleteObject / DeleteObjects（批量）/ HeadObject / CopyObject / Multipart 全流程（Create/UploadPart/Complete/Abort + ListParts/ListMultipartUploads）/ GetBucketLocation / KSO-1 签名 / token 自动续期 / 只读模式 / 多 S3 凭证 / **restic REST backend（§9）**。

**不做（后续按需加）**：
- ACL / 策略 / 版本控制 / 标签
- 任意 `x-amz-meta-*` 元数据；条件请求头（If-*）；`encoding-type=url`（rclone 增量对比用 `size_only = true`，见 README）
- 大目录分页的深度缓存——逐级实时查询，路径 → ID 用 TTL 内存缓存
- WebDAV、仓库删除/迁移（restic 本身没有 repo delete；WPS 删除又只能进回收站）

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
7. **`children` 的 256 目录页**：一页全是目录时（`page_size=500`）只返回 256 条且**不返回 `next_page_token`**；全是文件时 500 条正常翻页。`data/` 正好 256 个分片所以当前安全；分片数若超过 256，这个假设要重新验证。
8. **`children` 不传 `page_size`** 会返回 400 `400000004 请求参数不支持`；网关固定传 500。

## 8. 配置示例

```jsonc
{
  // 字符串或数组；数组可同时监听回环与内网/tailnet，供异地的 rustic 直连
  "host": ["127.0.0.1", "<内网或 tailnet 地址>"],
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

REST 端点没有独立配置项：复用 `buckets`、`s3Credentials`、`readOnly`、`uploadConcurrency`。

## 9. REST backend（restic / rustic）

S3 之外的第二条协议通道，实现在 `src/rest.js`，挂载在 `/rest`。目标是让 restic/rustic 直接备份，
不替代 S3；两者读写同一份目录树。实测记录见 [restic-notes.md](restic-notes.md)。

### 9.1 端点

| 方法 | 路径 | 语义 |
|------|------|------|
| POST | `/<bucket>/<repo>/?create=true` | 建仓库目录（`config` + 5 个类型目录），幂等 |
| GET / HEAD / POST / DELETE | `/<bucket>/<repo>/config` | 仓库配置；POST 已存在返回 403 |
| GET | `/<bucket>/<repo>/<type>/` | 列举：v1 返回名字数组，v2 返回 `{name,size}` |
| GET / HEAD / DELETE | `/<bucket>/<repo>/<type>/<sha256>` | 读 / 探活 / 删除；DELETE 不存在也返回 200 |
| POST | 同上 | 上传；已存在返回 403 |

`<type>` ∈ `data` / `index` / `keys` / `locks` / `snapshots`。仓库路径可以多级（`/rest/personal/backups/restic/`）。

### 9.2 布局：URL 是平的，盘上是分片的

restic 的 REST 协议 URL 是 `/data/<sha256>`，但 rest-server 的磁盘布局是 `data/<sha前两位>/<sha256>`。
网关按 rest-server 的布局落盘，分片在服务端做：

- `data/<ab>/<abcdef…>`；`index` / `keys` / `locks` / `snapshots` 平铺
- 因此同一个仓库既能用 S3 访问（看到 `data/ab/…`）也能用 REST 访问（URL 始终平）
- 列举 `data/` = 并发拉 256 个分片再合并（并发 16）

### 9.3 上传

pack 可达 128MB，不能整块进内存：

1. 请求体流式写临时文件（`os.tmpdir()`，`TMPDIR` 可改），同时算 sha256
2. 校验 `sha256 == 对象名`（`config` 除外）；`Content-Length` 与实际字节数不符返回 400
3. `request_upload`（带 size + sha256 与 `on_name_conflict: overwrite`）→ 直传 → `commit_upload`
4. 把新对象写进目录缓存，保证紧接着的 HEAD/GET 命中（WPS children 有最终一致窗口）

并发受 `uploadConcurrency` 限制，临时文件在 `finally` 删除。

### 9.4 缓存策略

`data/` 一次列举全量对象，不可能每个请求都做。REST 层自己维护 `parentId → Map(name → node)`：

- 读路径命中不了会强制刷新一次，让外部新增可见
- 写/删直接改 Map，所以本进程的写入立即可见
- TTL 60s 只作为外部改动的兜底
- 不复用 S3 的 `childrenAll` 缓存：那边缓存的是排序数组，REST 需要可增删的 Map

### 9.5 状态码契约（改动时必须保持）

| 场景 | 返回 | 原因 |
|------|------|------|
| 列举 v2 | `Content-Type: application/vnd.x.restic.rest.v2`，**不带 charset** | restic 精确比较该字符串决定按 v1 还是 v2 解析 |
| POST 已存在 | 403 | restic 声明 `HasAtomicReplace: false` |
| DELETE 不存在 | 200 | 删除必须幂等；rustic 用 `error_for_status`，404 会报错 |
| HEAD | 200 + 精确 `Content-Length` | Stat |
| GET + Range | 206 + 精确字节数 | pack 头读取 |
| 仓库/类型目录不存在 | 404 | restic 对 List 的 404 按空仓库处理 |

### 9.6 开销与限制

- **每次读对象多一次 WPS 调用**：`/download` 取直链。全量 `check` 的调用次数等于 pack 数量，只在限时窗口里跑
- Basic 明文认证，只适合本机/内网
- prune 删除对象后分片目录会留下空目录（无害，不自动回收）
- 不验 `mtime`：时间戳全在 restic 自己的 snapshot/index JSON 里

## 10. Token broker（多机共用一份 OAuth 会话）

WPS 的 OAuth 是**单会话**：同一 (应用, 用户) 第二次设备码授权会让旧 `refresh_token`
立即 401。所以多机不能各自登录，但可以让一台机器独占刷新链、其它机器只借 access token。

```
xs2  gateway（broker 模式）  ← 独占 tokens.json
  GET  /oauth/token    按需刷新后返回 {access_token, expires_at}   Bearer 鉴权
  POST /oauth/refresh  强制刷新（客户端收到 WPS 401 后调）
  GET  /oauth/login    发起设备码授权，返回链接；后台轮询，成功即生效
  GET  /oauth/status   {ok, expires_at, last_refresh, last_error, login_pending}
        │  tailnet（只有 token，没有数据）
   sg / hk2 / sg2  各自跑网关（tokenBroker 模式）→ 数据直连 WPS
```

- 客户端 `tokenBroker = { url, token }`：不落任何 token 文件，`ensureToken` 向 broker 取，
  401 时调 `/oauth/refresh` 后重试一次。
- 刷新在 broker 内**互斥**：并发请求只触发一次，避免 refresh_token 单次使用被抢跑作废。
- 每台机器一个随机 Bearer（`brokerTokens`），日志里能看出是谁在刷。
- 需要人工重授权时，broker 用 `notify.sh` 把设备码链接推 Telegram，点一下即可。
- 取舍：broker 挂了所有 WPS 备份停（数据安全不受影响），换取数据面不再经过单台机器。
