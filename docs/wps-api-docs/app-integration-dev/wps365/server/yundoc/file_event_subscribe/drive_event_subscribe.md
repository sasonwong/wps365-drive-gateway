# 开放平台应用订阅云文档事件

# 开放平台应用订阅云文档事件

## API 说明

在开放平台应用需要订阅云文档相关文件事件的场景下，调用该接口，可以实现订阅对应事件

## 元信息
```yaml
name: open_v7_drive_event_subscribe
description: "订阅云文档文件事件"
metadata:
  business_domain: "云文档"
  updated-on: "2026-05-25"
  tags: "drive,event,subscribe"
  operation-id: "open_v7_drive_event_subscribe"
  auth-type: "app_and_user_token"
  scopes: "kso.file.read, kso.file_permission.readwrite"
  rate-limit: "无"
```

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drive/event/subscribe          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 用于开放平台应用订阅文件更新事件 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询文件(用户授权) `kso.file.read`

查询和管理文件权限(用户授权) `kso.file_permission.readwrite`

查询文件(应用授权) `kso.file.read`

查询和管理文件权限(应用授权) `kso.file_permission.readwrite`

 |

## 请求头（Headers）

| Header 名称 | 参数类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
|-------------|----------|----------|--------|------|------|------|
| Content-Type | string | 是 | `application/json` | - | `application/json` | 请求体格式 |
| Authorization | string | 是 | - | - | `Bearer t-g1045lOafDJeLmyBGREj00eTSA3fNVYECHGEF006NBC` | 授权凭证，格式为：Bearer {access_token} |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 appid="xxx":timestamp="1234567890":nonce="abc":signed_headers="":signature="yyy"` | KSO-1 签名，参见[签名方式说明](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| X-Kso-Date | string | 是 | - | - | `2026-05-25T15:00:00+08:00` | 请求时间戳，用于签名校验防重放 |

## 请求体（Body）
**请求体格式:** `application/json`
订阅类型
file_update：文件更新事件
file_permission_create：添加文件协作者事件
file_permission_delete：删除文件协作者事件
file_permission_apply：文件协作者权限申请事件
",resource_id: 与resource_type对应，是fileId，driveId，corpId。前端传入时，应该考虑v7接口的混淆id
\n,resource_type: 资源范围；file：文件；drive：盘；corp：企业
\n,]' />

## 请求体示例
```json
{
  "event_type": "file_update",
  "resource_id": "ccquoBKVddnG", // 一个文件的 linkId
  "resource_type": "file"
}
```

## 请求示例

```bash
POST /open/v7/drive/event/subscribe HTTP/1.1
Host: openapi.wps.cn
Content-Type: application/json
Authorization: KSO-1 

{
  "event_type": "file_update",
  "resource_id": "ccquoBKVddnG",
  "resource_type": "file"
}
```

## 响应体（Response）
**HTTP状态码:** `200`

**响应体格式:** `application/json`
错误码，0 表示成功
",msg: 错误描述，成功时为空字符串
]' >

## 响应示例

成功
```json
{
  "code": 0,
  "msg": "ok",
  "data": {}
}
```

失败(参数错误)
```json
{
  "code": 400000002,
  "msg": "invalid argument",
  "data": {}
}
```

## 响应体示例

```json
{
  "code": 0,
  "msg": "ok"
}
```

## 错误码

| HTTP状态码 | 错误码 | 错误描述 | 排查建议 |
|-----------|--------|----------|----------|
| 200 | 0 | 成功 | 订阅创建成功（已存在则幂等成功） |
| 200 | 400000002 | 参数格式错误 | 检查 event_type 是否在合法枚举内，resource_type 是否为 file/drive/corp |
| 401 | 401000001 | 鉴权失败 | 检查 X-Kso-Authorization 签名是否正确、X-Kso-Date 是否过期 |
| 403 | 403000001 | 无权限 | 检查应用是否已申请 kso.file.read 或 kso.file_permission.readwrite 权限 |
| 500 | 500000001 | 远程服务错误 | 服务内部依赖异常，请稍后重试或联系管理员 |