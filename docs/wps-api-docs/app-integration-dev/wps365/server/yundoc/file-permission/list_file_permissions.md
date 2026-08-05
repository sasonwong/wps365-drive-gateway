# 列举文件权限列表

# 列举文件权限列表

**标签**：`文件权限` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/permissions          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 列举文件权限列表 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件权限(用户授权) `kso.file_permission.readwrite`

查询文件权限(用户授权) `kso.file_permission.read`

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
 | `string` | 是 | drive_id表示盘id，参考drive.list_drives接口返回的data.items[?].id | - 
| file_id
 | `string` | 是 | file_id表示文件id,参考drive.list_file接口返回的data.items[?].id，支持传0，表示盘的根目录 | - 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| subject_type
 | `object` | 否 | 类型筛选 | - 
| subject_ids
 | `array` | 否 | 传入授权主体id | - 
| with_subject_tags
 | `boolean` | 否 | 私有云适用，是否返回授权对象的附属属性标记信息 默认为false | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
是否有自定义权限,用于重置功能
items: -,role_id: 角色id
\n,role_name: 角色名称
\n,subject_attr: -,"children":[member_tag: 团队内自定义标签组
\n,"children":[],"isOneOfItem":true,"oneOfIndex":0},company_id: subject_type = dept时，传递dept所在的company_id
\n,"children":[],"isOneOfItem":true,"oneOfIndex":1}subject_avatar: 权限主体头像信息
\n,subject_id: 权限主体标识
\n,subject_name: 权限主体名称
\n,subject_tags: 私有云适用，传递权限授权对象的附属属性标签
\n,subject_type: 权限主体类型
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "has_custom_permission": true,
    "items": [
      {
        "id": "string",
        "role_id": "string",
        "role_name": "string",
        "member_tag": "string",
        "subject_avatar": "string",
        "subject_id": "string",
        "subject_name": "string",
        "subject_tags": [
          "string"
        ],
        "subject_type": "company"
      }
    ]
  },
  "code": 0,
  "msg": "string"
}
```