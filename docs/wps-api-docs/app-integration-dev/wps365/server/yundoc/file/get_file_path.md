# 获取文件路径

# 获取文件路径

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/path          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取文件路径 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询文件(应用授权) `kso.file.read`

查询和管理文件(用户授权) `kso.file.readwrite`

查询文件(用户授权) `kso.file.read`

 |

## 请求头 (Headers)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| X-Kso-Id-Type
 | `string` | 否 | 类型
  * **internal** - 内部
  * **external** - 外部
 | `internal`, `external` 

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 
| file_id
 | `string` | 是 |  | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
文件路径信息
location_type: 文件位置类型
\n,paths: 文件路径
\n,name: -code: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "location_id": "string",
    "location_type": "link",
    "paths": [
      {
        "file_id": "string",
        "name": "string"
      }
    ]
  },
  "code": 0,
  "msg": "string"
}
```