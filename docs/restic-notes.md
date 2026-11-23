# restic / rustic REST 端点实测记录（真实仓库）

> 开发过程笔记：协议契约、真实仓验证、踩坑与限制。读者对象是后续维护者。
> 协议实现在 `src/rest.js`，架构见 [DESIGN.md](DESIGN.md) §9。

## 验证环境

- 客户端：**rustic**（rustic 的 REST 客户端比 restic 严格：只认 v2 列举，DELETE 用
  `error_for_status`。它能过，restic 大概率也能过；但 restic 本体没有实际安装验证）
- 真实仓：一个完整的 restic 仓（snapshots / packs / index / keys 齐全）
  规模足以覆盖分页与分片路径
- 网关跑在本机，直连 `openapi.wps.cn`（KSO-1 签名开启）

## 验证结果

| 操作 | 结果 |
|------|------|
| `GET /data/`（v2） | 全部条目，与 S3 列举数量一致 |
| `GET /index/` | 条目齐全 |
| `rustic snapshots` | 快照列表正确 |
| `rustic dump` 单张 JPEG | 内容字节一致 |
| `rustic check` | 通过；瞬时连接错误自动重试成功 |
| 新建仓 `init/backup/check --read-data/forget --prune/restore` | 全通过 |
| 物理布局 | `data/<xx>/<sha256>`；64 位 hex 无扩展名原样保留 |

测试仓已删除。真实仓只做读 + rustic 自己的 lock（`locks/` 事后为空，2 个 snapshot 未变）。

## 为什么 `data` 要分片（第一版的 bug）

第一版把 `data/` 当平铺目录（REST 协议 URL 确实是平的 `/data/<sha256>`），
但真实仓的 `data/` 下全是 **256 个分片目录**——rest-server 的磁盘布局是
`data/<sha前两位>/<sha256>`。列举时过滤掉目录后返回空列表，`check` 读每个 pack 都 404。

修复方式：URL 保持平，分片在服务端做。副作用是好的——**同一个仓库现在 S3 和 REST 都能读**，
不需要迁移。`?create=true` 只建 5 个类型目录，分片目录在 POST 时按需创建。

## 协议契约（改代码前先看）

| 要求 | 细节 | 不做的后果 |
|------|------|-----------|
| 列举 v2 | `Content-Type: application/vnd.x.restic.rest.v2`，**不能带 charset** | restic 精确比较该字符串，带 `; charset=utf-8` 会退回 v1 解析 |
| v1 列举 | `application/vnd.x.restic.rest.v1` + 名字数组 | 老客户端会 HEAD 每个对象 |
| POST 已存在 | 403 | restic 声明 `HasAtomicReplace: false`，靠这个避免覆盖 |
| DELETE 不存在 | 200（幂等） | rustic 用 `error_for_status`，404 会被当错误 |
| HEAD | 200 + 精确 `Content-Length` | `Stat` / `GET /config` 探活失败 |
| GET + Range | 206 + 精确字节数 | pack 头读取失败（rustic 会校验长度） |
| 4xx 语义 | 401/403/416/507 被 restic 当**永久错误**，不重试 | 限流别用 403，用 429/503 |
| 仓库/类型目录不存在 | 404（List 的 404 被 restic 当空仓库容忍） | 列目录报错 |

另：`?create=true` 返回 200；`POST /config` 已存在返回 403；仓库路径支持中文等多级目录。

## WPS API 侧的两个坑

1. **一页全是目录时的 256 截断**：`page_size=500` 只回 256 条且**不返回 `next_page_token`**；
   全是文件时 500 条正常翻页（`index/` 上千个文件，按 500/页翻了多页）。
   `data/` 正好 256 个分片所以当前安全；分片数若超过 256，这个假设要重新验证（见 `src/rest.js` 注释）。
2. **`children` 不传 `page_size`** 返回 400 `400000004 请求参数不支持`；网关固定传 500。

## 开销

- **每次读对象多一次 WPS 调用**：`/download` 取直链+ 1 次 CDN GET。
  全量 `check` 的调用次数等于 pack 数量，放在限时窗口里跑。
- `data/` 首次列举：256 个分片，并发拉取；之后走进程内缓存，写操作即时更新。
- 上传：请求体先落临时文件（`os.tmpdir()`，`TMPDIR` 可改）并算 sha256，再走三段式上传；
  并发受 `uploadConcurrency` 限制，pack 不进内存。
- 列举缓存 TTL 60s 只兜底外部改动；本进程的写入/删除立即反映在缓存里。

## 限制与未验证

- **restic 本体未验证**，只验了 rustic；两者的 v1/v2 与错误码处理对服务端要求一致
- `check` 全量跑时出现过瞬时连接错误，网关侧无业务错误日志，重试后成功；
  高并发下 WPS 直链偶发重置，未定位到根因
- Basic 明文认证，只适合本机/内网
- prune 后分片目录会留下空目录（无害，不自动回收）
- restic 没有 repo delete；要删仓库只能逐对象删除或删目录（进 WPS 回收站，
  二级回收站 API 清不掉）

## 复现

```bash
# 只读验证（不写仓库）
rustic -r rest:http://user:pass@127.0.0.1:9000/rest/personal/<repo>/ \
  --password-file <pw> snapshots
rustic -r rest:http://user:pass@127.0.0.1:9000/rest/personal/<repo>/ \
  --password-file <pw> check

# 端到端（新建测试仓，会写盘）
rustic -r rest:http://user:pass@127.0.0.1:9000/rest/personal/rustic/rest-e2e/ \
  --password-file <pw> init
rustic -r ... backup /tmp/src
rustic -r ... check --read-data
rustic -r ... forget --keep-last 1 --prune
rustic -r ... restore latest /tmp/dst
```

离线回归：`npm test` 里的 `test/rest-e2e.test.js` 会起一个 fake WPS + 网关，
用真实 rustic 二进制跑 init/backup/check --read-data/forget --prune/restore；
没装 rustic 时自动 skip。协议契约单测在 `test/rest.test.js`。
