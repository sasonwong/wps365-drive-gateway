# 批量授权(单个文件)

# 批量授权（单个文件)

**标签**：`文件权限` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/permissions/batch_create          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 批量新建文件权限项。如授权主体已存在时，则会更新相应权限角色。 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件权限(应用授权) `kso.file_permission.readwrite`

查询和管理文件权限(用户授权) `kso.file_permission.readwrite`

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
 | `string` | 是 | drive_id表示盘id，参考drive.v7_list_drives接口返回的data.items[?].id | - 
| file_id
 | `string` | 是 | file_id表示文件id,参考drive.v7_list_files接口返回的data.items[?].id，支持传0，表示盘的根目录 | - 

## 请求体(Body)
**请求体格式:** `application/json`
授权后是否通知被授权用户，默认通知
overwrite: 是否覆盖子文件
\n,role_id: 权限角色。支持仅查看/可查看/可评论/可编辑/可管理 (对应接口传参：可查看viewable(公网)、仅查看view_only、可编辑editable、可评论commentable、可管理manageable、可分享shareable(私有云)、禁止访问prohibited(私有云)) 和自定义权限角色 (自定义权限角色请通过获取权限角色列表v7_list_drive_roles获取role_id；)
\n,subjects: 授权主体列表
\n,"children":[subject_attr: 主体限制条件
\n,"children":[member_tag: 团队内自定义标签组
\n,"children":[],"isOneOfItem":true,"oneOfIndex":0},company_id: subject_type = dept时，传递dept所在的company_id
\n,"children":[],"isOneOfItem":true,"oneOfIndex":1}subject_id: 权限主体标识
\n,subject_type: 权限主体类型，支持授权给用户、部门、企业、用户组
\n]' />

## 请求体示例
```json
{
  "notify_subject_user": true,
  "overwrite": true,
  "role_id": "string",
  "subjects": [
    {
      "member_tag": "string",
      "subject_id": "string",
      "subject_type": "company"
    }
  ]
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