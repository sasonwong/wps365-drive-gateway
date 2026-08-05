# 获取漫游设备列表

# 获取漫游设备列表

## API 说明

获取漫游设备列表。

**注意事项：**

- `page_size` 为必填参数，公网最大值为 `500`。

**使用限制：**

- 建议结合 `page_token` 进行分页遍历，直到 `next_page_token` 为空。

## 请求说明

| 字段 | 值 |
| --- | --- |
| 请求地址 | `https://openapi.wps.cn/v7/roaming_devices` |
| HTTP 方法 | `GET` |
| 签名方式 | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| 限频策略 | 无 |
| 权限要求 | 查询和管理文件(应用授权) kso.file.readwrite
查询文件(应用授权) kso.file.read
查询和管理文件(用户授权) kso.file.readwrite
查询文件(用户授权) kso.file.read
 |

## 请求头（Headers）

| Header 名称 | 参数类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Thu, 25 Jun 2026 08:34:00 GMT` | 请求时间，用于签名校验 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 {access_key}:{signature}` | KSO-1 签名值 |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证 |

## 查询参数（Query）

| 属性名 | 类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| page_size | integer | 是 | - | 公网最大 `500` | `20` | 分页大小 |
| page_token | string | 否 | - | - | `next_token_xxx` | 分页 token |

## 请求示例

```bash
curl -X GET "https://openapi.wps.cn/v7/roaming_devices?page_size=20&page_token=next_token_xxx" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "X-Kso-Date: Thu, 25 Jun 2026 08:34:00 GMT" \
  -H "X-Kso-Authorization: {{kso1_signature}}"
```

## 响应体（Response）
**HTTP状态码:** `200`

**响应体格式:** `application/json`
漫游设备列表
ctime: 设备在云端对应文件夹创建时间
\n,drive_id: 设备在云端对应的驱动盘ID
\n,file_id: 设备在云端对应文件夹ID
\n,mtime: 设备在云端对应文件夹修改时间
\n,name: 设备文件夹名称
\nid: 漫游设备ID，由服务端分配
\n,local: 本地漫游设备信息
\n,device_id: 本地设备ID，由客户端提交
\n,mtime: 设备修改时间
\n,name: 设备名称，如：DESKTOP-PMGBH51（设备所在电脑的名称）
\n,owner_id: 设备所有者
\n,type: 设备类型
\nnext_page_token: 下一页token
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应示例

```json
{
  "data": {
    "items": [
      {
        "cloud": {
          "company_id": "string",
          "ctime": 0,
          "drive_id": "string",
          "file_id": "string",
          "mtime": 0,
          "name": "string"
        },
        "id": "string",
        "local": {
          "ctime": 0,
          "device_id": "string",
          "mtime": 0,
          "name": "string",
          "owner_id": "string",
          "type": "PC"
        }
      }
    ],
    "next_page_token": "string"
  },
  "code": 0,
  "msg": "string"
}
```

## 错误码

| **HTTP状态码** | **错误码** | **错误描述** | **排查建议** |
| --- | --- | --- | --- |
| 400 | 400000004 | 请求参数不支持 | 请检查请求参数是否正确 |