# 删除文档权限角色

# 删除文档权限角色

**标签**：`文件权限角色` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/roles/{role_id}/delete          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 即将被删除的文档权限角色可能被授权引用，需要指明删除后已存在的授权如何处理，目前支持替换、删除两种方式 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件权限(应用授权) `kso.file_permission.readwrite`

查询和管理文件权限(用户授权) `kso.file_permission.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 | drive_id表示盘id，参考drive.list_drives接口返回的data.items[?].id | - 
| role_id
 | `string` | 是 | role_id表示权限角色id,参考list_roles接口返回的data.imems[?].id | - 

## 请求体(Body)
**请求体格式:** `application/json`
删除策略
replace_role_id: 权限角色。支持仅查看/可查看/可评论/可编辑/可管理 (对应接口传参：可查看viewable(公网)、仅查看view_only、可编辑editable、可评论commentable、可管理manageable、可分享shareable(私有云)、禁止访问prohibited(私有云)) 和自定义权限角色 (自定义权限角色请通过获取权限角色列表v7_list_drive_roles获取role_id；)
\n,]' />

## 请求体示例
```json
{
  "policy": "remove",
  "replace_role_id": "string"
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