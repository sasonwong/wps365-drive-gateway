# 设置文件密级标签

# 设置文件密级标签

## API 说明

设置文件密级标签

## 请求说明

| 字段 | 值 |
| --- | --- |
| 请求地址 | `https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/sec_label/attach` |
| HTTP 方法 | `POST` |
| 签名方式 | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| 限频策略 | 无|
| 权限要求 | 用户授权：`kso.secret_label_file.write` |

## 请求头（Headers）

| Header 名称 | 参数类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| Content-Type | string | 是 | `application/json` | 固定为【application/json】 | `application/json` | 请求体格式。 |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Mon, 29 Jun 2026 07:50:00 GMT` | 请求时间。 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 AK...:...` | KSO-1 签名值，详见 [签名方法](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description)。 |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证，格式为：Bearer {access_token}，获取方式详见 [认证授权概述](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/certification-authorization/summary)。 |

## 路径参数（Path）

| 属性名 | 类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| drive_id | string | 是 | - | 字符长度[1,1024] | `drive_example_001` | 云文档空间 ID。 |
| file_id | string | 是 | - | 字符长度[1,1024] | `file_example_001` | 文件 ID。 |

## 请求体（Body）

| 参数名称 | 参数类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| label_id | string | 是 | - | 字符长度[1,1024] | `123` | 标签 ID，如果为 `0` 则移除标签。 |
| reason | string | 否 | - | 最大长度255 | `调整文件密级标签` | 修改密级标签理由，如果是调低密标等级时必填。 |

## 请求示例

```bash
curl -X POST "https://openapi.wps.cn/v7/drives/drive_example_001/files/file_example_001/sec_label/attach" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -H "X-Kso-Date: Mon, 29 Jun 2026 07:50:00 GMT" \
  -H "X-Kso-Authorization: {{kso1_signature}}" \
  -d '{
    "label_id": "123",
    "reason": "调整文件密级标签"
  }'
```

## 响应体（Response）

| 参数名称 | 参数类型 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- |
| code | integer | - | - | `0` | 返回码。 |
| msg | string | - | - | `success` | 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。 |
| data | object | - | - | `{}` | 响应数据。 |

## 响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {}
}
```

## 错误码

| HTTP状态码 | 错误码 | 错误描述 | 排查建议 |
| --- | --- | --- | --- |
| 400 | 400000001 | 流量超出 | 降低请求频率后重试。 |
| 400 | 400000002 | 请求参数格式有误 | 检查路径参数和请求体字段格式是否符合接口要求。 |
| 400 | 400000003 | 请求参数取值无效 | 检查参数取值是否在有效范围内。 |
| 400 | 400000004 | 请求参数不支持 | 移除或更正不支持的参数后重试。 |
| 400 | 400000005 | 加锁失败，锁已被占用 | 稍后重试，避免并发修改同一资源。 |
| 400 | 400000006 | 释放锁失败，锁已被占用或不存在 | 稍后重试；若持续出现，请联系技术支持排查锁状态。 |
| 400 | 400000007 | 非法参数 | 检查请求参数是否合法。 |
| 400 | 400000101 | 集合为空 | 确认请求涉及的集合资源是否存在数据。 |
| 400 | 400000102 | 集合不为空 | 清理相关集合数据后重试。 |
| 400 | 400000103 | 资源不存在 | 确认 `drive_id`、`file_id` 或 `label_id` 是否正确。 |
| 400 | 400000104 | 资源已经存在 | 避免重复创建或重复设置相同资源。 |
| 400 | 400000105 | 数目限制超出 | 减少请求涉及的资源数量后重试。 |
| 400 | 400000106 | 长度限制超出 | 检查字符串长度是否超过接口限制。 |
| 400 | 400000201 | 客户端其他错误 | 根据返回信息调整请求后重试。 |
| 401 | 401000001 | 终端用户令牌认证错误或者开发者签名验证错误 | 检查 access token、签名参数和系统时间是否正确。 |
| 403 | 403000001 | 无权限 | 确认应用或用户已获得 `kso.secret_label_file.write` 权限。 |
| 403 | 403000002 | 策略判定拒绝 | 检查企业策略或密级标签策略是否允许当前操作。 |
| 404 | 404000001 | 资源未找到 | 确认请求路径和资源 ID 是否正确。 |
| 415 | 415000001 | 不支持的 Content-Type | 确认请求头 `Content-Type` 为 `application/json`。 |
| 429 | 429000001 | 请求太频繁 | 降低请求频率后重试。 |
| 499 | 499000001 | 请求被取消 | 检查客户端是否主动取消请求或网络连接是否中断。 |
| 500 | 500000001 | 远程错误 | 稍后重试；若持续出现，请联系技术支持。 |
| 500 | 500000002 | 断路器已打开 | 稍后重试。 |
| 500 | 500000003 | 存储服务错误 | 稍后重试；若持续出现，请联系技术支持。 |
| 500 | 500000004 | 内部服务错误 | 稍后重试；若持续出现，请联系技术支持。 |
| 503 | 503000001 | 服务数据升级中 | 等待服务升级完成后重试。 |
| 999 | 999999999 | 未知错误 | 保留请求信息并联系技术支持排查。 |
