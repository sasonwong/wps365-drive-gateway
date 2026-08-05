# 解决/恢复正文评论

# 解决/恢复正文评论

能力范围：该 RPC 仅供 AP 组件使用。

root_id 仅 AP 组件侧正文评论具备，须与列表/单条接口返回的 ContentComment.root_id 一致，通过请求体传入

**标签**：`通用文档处理文档正文评论` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/documents/{file_id}/content_comments/update_status          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 能力范围：该 RPC 仅供 AP 组件使用。

root_id 仅 AP 组件侧正文评论具备，须与列表/单条接口返回的 ContentComment.root_id 一致，通过请求体传入 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 文档管理能力(应用授权) `kso.documents.readwrite`

通用文档管理能力(用户授权) `kso.documents.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| file_id
 | `string` | 是 | 文件ID，必填从路径参数获取 | - 

## 请求体(Body)
**请求体格式:** `application/json`
评论解决标志
root_id: 评论根ID，必填从请求体传入，仅 AP 组件正文评论会产出该标识，须与同文档下评论数据中的 root_id 一致
\n,]' />

## 请求体示例
```json
{
  "is_resolved": true,
  "root_id": "string"
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
]' >

## 响应体示例
```json
{
  "code": 0,
  "msg": "string"
}
```