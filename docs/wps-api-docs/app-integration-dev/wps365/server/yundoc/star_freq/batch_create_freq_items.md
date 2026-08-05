# 批量添加常用项

# 批量添加常用项

批量添加常用项

**标签**：`文件`

## API 说明

批量添加常用项。

**注意事项：**

- `objects` 为批量数组，每项都必须包含 `id` 与 `type`。

**使用限制：**

- `type` 当前仅支持 `file`、`drive`。

## 请求说明
| 字段 | 值 |
| --- | --- |
| 请求地址 | `https://openapi.wps.cn/v7/drive_freq/items/batch_create` |
| HTTP 方法 | `POST` |
| 接口描述 | 批量添加常用项 |
| 签名方式 | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| 限频策略 | 无 |
| 权限要求 | 应用授权：`kso.file.readwrite`
用户授权：`kso.file.readwrite` |

## 请求头（Headers）
| Header 名称 | 参数类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| Content-Type | string | 是 | `application/json` | 固定为 `application/json` | `application/json` | 请求体格式 |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Thu, 25 Jun 2026 08:52:00 GMT` | 请求时间，用于签名校验 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 {access_key}:{signature}` | KSO-1 签名值 |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证 |

## 请求体（Body）
**请求体格式:** `application/json`
常用对象列表
type: 被打标签对象类型(暂时仅支持 file|drive 文件|驱动盘)
\n]' />

## 请求体示例
```json
{
  "objects": [
    {
      "id": "string",
      "type": "file"
    }
  ]
}
```

## 请求示例
```bash
curl -X POST "https://openapi.wps.cn/v7/drive_freq/items/batch_create" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -H "X-Kso-Date: Thu, 25 Jun 2026 08:52:00 GMT" \
  -H "X-Kso-Authorization: {{kso1_signature}}" \
  -d '{
    "objects": [
      {
        "id": "string",
        "type": "file"
      }
    ]
  }'
```

## 响应体（Response）
**HTTP状态码:** `200`

**响应体格式:** `application/json`
人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
]' >

## 响应示例
```json
{
  "data": {},
  "code": 0,
  "msg": "string"
}
```

## 错误码

| **HTTP状态码** | **错误码** | **错误描述** | **排查建议** |
| --- | --- | --- | --- |
| 400 | 400000004 | 请求参数不支持 | 请检查请求参数是否正确 |