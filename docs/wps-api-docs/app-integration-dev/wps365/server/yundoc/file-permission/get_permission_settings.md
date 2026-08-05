# 获取文件权限配置项

# 获取文件权限配置项

**标签**：`文件权限` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/files/{file_id}/permission_settings          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取文件权限配置项 |
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
| file_id
 | `string` | 是 | file_id表示文件id,参考drive.v7_list_files接口返回的data.items[?].id | - 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| keys
 | `array` | 是 | 权限相关设置枚举（allow_guest_create_upload：允许团队外用户上传） | `allow_guest_create_upload`, `share_entity`, `copy_content_entity`, `save_as_entity`, `upload_entity`, `rename_entity`, `move_entity` 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
权限相关设置枚举（allow_guest_create_upload：允许团队外用户上传
\nshare_entity：（仅支持公网）谁可以添加、移除协作者，支持可查看viewable、可编辑editable、可评论commentable、可管理manageable
\ncopy_content_entity：（仅支持公网）谁可以复制内容，支持可查看viewable、可编辑editable、可评论commentable、可管理manageable
\nsave_as_entity：（仅支持公网）谁可以打印、下载、另存为，支持可查看viewable、可编辑editable、可评论commentable、可管理manageable
\nupload_entity：（仅支持公网）谁可以上传文件，支持可编辑editable、可管理manageable
\nrename_entity：（仅支持公网）谁可以重命名文件，支持可编辑editable、可管理manageable
\nmove_entity：（仅支持公网）谁可以移动、删除文件，支持可编辑editable、可管理manageable
\n）
value: key为allow_guest_create_upload时，value为true/false
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "items": [
      {
        "key": "allow_guest_create_upload",
        "value": "string"
      }
    ]
  },
  "code": 0,
  "msg": "string"
}
```