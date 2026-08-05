# 批量文件下载

# 批量文件下载

批量文件下载

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/batch_download          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 批量文件下载 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 无 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| file_ids
 | `array` | 是 | 文件id列表，数量上限根据用户权益限制 | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
批量获取文件下载信息响应体
code: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应体示例
```json
{
  "data": {
    "url": "string"
  },
  "code": 0,
  "msg": "string"
}
```