# WPS 开放平台 API 文档快照（离线抓取）

本目录内容**抓取自 WPS 开放平台官方文档站**，非本仓库原创：

- **来源**：<https://open.wps.cn/docs>（WPS 开放平台文档中心，WPS 365 服务端 API）
- **抓取方式**：`scripts/fetch-wps-docs.mjs`（从 `open.wps.cn/docs/api/collections/wps365` 目录树递归抓取，Markdown 源来自 `open-docs.wpscdn.cn`）
- **抓取时间**：2026-08（提交 `c05ad92`）

## 说明

- 仅供本地开发、离线查阅参考；**以官方在线文档为准**，接口可能随版本变化
- 文中示例（如 `AK123456` / `sk098765` / 签名计算值等）均为**官方文档自带的演示数据**，非真实凭据
- 文档版权归 WPS 官方所有，本仓库仅做技术性收录
- 重新抓取：`node scripts/fetch-wps-docs.mjs`
