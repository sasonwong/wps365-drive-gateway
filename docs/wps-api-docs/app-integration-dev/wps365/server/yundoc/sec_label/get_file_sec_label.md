# 获取文件已设置的密级标签

# 获取文件已设置的密级标签 

获取文件已设置的密级标签 

**标签**：`密级标签` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/sec_label          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取文件已设置的密级标签  |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询密级标签(应用授权) `kso.secret_label_file.read`

查询密级标签(用户授权) `kso.secret_label_file.read`

 |

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
人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
data: -,label: 标签
\n,id: 标签ID
\n,level: 标签等级
\n,name: 标签名称
\n]' >

## 响应体示例
```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "has_perm_edit": true,
    "label": {
      "description": "string",
      "id": "string",
      "level": 0,
      "name": "string"
    }
  }
}
```