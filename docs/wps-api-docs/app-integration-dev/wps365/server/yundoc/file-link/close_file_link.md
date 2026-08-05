# 取消文件分享

# 关闭文件分享

关闭分享链接

**标签**：`文件分享` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/close_link          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 取消文件分享 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件分享(应用授权) `kso.file_link.readwrite`

查询和管理文件分享(用户授权) `kso.file_link.readwrite`

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
取消分享模式, pause|delete（暂停分享|删除分享）,默认pause（暂停分享）
]' />

## 请求体示例
```json
{
  "mode": "pause"
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