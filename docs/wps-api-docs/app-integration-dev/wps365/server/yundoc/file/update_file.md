# 修改文件元数据信息

# 修改文件元数据信息

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/update          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 修改文件元数据信息 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询和管理文件(用户授权) `kso.file.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 
| file_id
 | `string` | 是 |  | - 

## 请求体(Body)
**请求体格式:** `application/json`
文件扩展属性。公网目前支持的扩展属性：
\n\nprotected - 是否开启保护，属性值仅支持 "true" 和 "false"
\nguid - 安全文档guid，属性值仅支持字母和数字
\n,value: 属性值
\n]' />

## 请求体示例
```json
{
  "ext_attr": {
    "name": "string",
    "value": "string"
  }
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
]' />

## 响应体示例
```json
{
  "code": 0,
  "msg": "string"
}
```