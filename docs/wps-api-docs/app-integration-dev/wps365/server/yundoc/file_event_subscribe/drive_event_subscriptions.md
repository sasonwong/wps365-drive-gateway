# 开放平台应用获取订阅的云文档事件

# 开放平台应用获取订阅的云文档事件

## API 说明

查询当前应用在指定资源上已订阅的事件类型列表

## 元信息
```yaml
name: open_v7_drive_event_subscriptions
description: "获取应用订阅状态"
metadata:
  business_domain: "云文档"
  updated-on: "2026-05-25"
  tags: "drive,event,subscriptions"
  operation-id: "open_v7_drive_event_subscriptions"
  auth-type: "app_and_user_token"
  scopes: "kso.file.read, kso.file_permission.readwrite"
  rate-limit: "无"
```

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drive/event/subscriptions          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 查询当前应用在指定资源上已订阅的事件类型列表 |
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
| Content-Type | string | 否 | - | - | - | GET 请求无请求体，可不传 |
| Authorization | string | 是 | - | - | `Bearer t-g1045lOafDJeLmyBGREj00eTSA3fNVYECHGEF006NBC` | 授权凭证，格式为：Bearer {access_token} |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 appid="xxx":timestamp="1234567890":nonce="abc":signed_headers="":signature="yyy"` | KSO-1 签名，参见[签名方式说明](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| X-Kso-Date | string | 是 | - | - | `2026-05-25T15:00:00+08:00` | 请求时间戳，用于签名校验防重放 |

## 查询参数（Query）
资源范围
file：文件
drive：盘
corp：企业
",resource_id: 与resource_type对应，是fileId，driveId，corpId。前端传入时，应该考虑v7接口的混淆id
event_type: 要查询的事件类型，不传则返回该资源下全部已订阅事件类型
file_update：文件更新事件
file_permission_create：添加文件协作者事件
file_permission_delete：删除文件协作者事件
file_permission_apply：文件协作者权限申请事件
]' />

## 请求示例

```bash
GET /open/v7/drive/event/subscriptions?resource_type=file&resource_id=ccquoBKVddnG HTTP/1.1
Host: openapi.wps.cn
X-Kso-Authorization: KSO-1 
X-Kso-Date: 2026-05-25T15:00:00+08:00
```

## 响应体（Response）
**HTTP状态码:** `200`

**响应体格式:** `application/json`
错误码，0 表示成功
",msg: 错误描述，成功时为 ok
data: 响应数据
]' >

## 响应示例

成功（已订阅多种事件）
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "event_types": ["file_update", "file_permission_create"]
  }
}
```

成功（未订阅任何事件）
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "event_types": []
  }
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
  "msg": "ok",
  "data": {
    "event_types": ["file_update", "file_permission_create"]
  }
}
```

## 错误码

| HTTP状态码 | 错误码 | 错误描述 | 排查建议 |
|-----------|--------|----------|----------|
| 200 | 0 | 成功 | 查询成功，返回已订阅事件类型列表 |
| 200 | 400000002 | 参数格式错误 | 检查 event_type 是否在合法枚举内，resource_type 是否为 file/drive/corp |
| 401 | 401000001 | 鉴权失败 | 检查 X-Kso-Authorization 签名是否正确、X-Kso-Date 是否过期 |
| 403 | 403000001 | 无权限 | 检查应用是否已申请 kso.file.read 或 kso.file_permission.readwrite 权限 |
| 500 | 500000001 | 远程服务错误 | 服务内部依赖异常，请稍后重试或联系管理员 |
