# 获取文件操作权限

# 获取用户的文件操作权限

**标签**：`文件权限` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/permissions/acl          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 一个或多个用户对文件可以进行哪些操作，比如我可以对文件进行复制/移动/删除等。通常在文件右键菜单展示文件允许的操作入口。 |
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
 | `string` | 是 | drive_id表示盘id，参考drive.v7_list_drives接口返回的data.items[?].id | - 
| file_id
 | `string` | 是 | file_id表示文件id,参考drive.v7_list_files接口返回的data.items[?].id，支持传0，表示盘的根目录 | - 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| user_ids
 | `string` | 是 | 用户id列表,以','分割 | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
权限位
copy: 复制
\n,copy_content: 内容复制
\n,delete: 文件删除
\n,download: 下载
\n,history: 公有云适用，历史版本，仅公网支持
\n,list: 列表
\n,move: 文件移动
\n,new_empty: 新建
\n,perm_ctl: 权限管理
\n,preview: 预览
\n,print: 打印
\n,rename: 文件重命名
\n,saveas: 公有云适用，另存为，仅公网支持
\n,secret: 公有云适用，安全文档，仅公网支持
\n,share: 分享
\n,update: 编辑/更新
\n,upload: 上传：手动上传新版本
\npermission_bits: 文件操作权限
\n,copy: 复制
\n,copy_content: 内容复制
\n,delete: 文件删除
\n,download: 下载
\n,history: 公有云适用，历史版本，仅公网支持
\n,list: 列表
\n,move: 文件移动
\n,new_empty: 新建
\n,perm_ctl: 权限管理
\n,preview: 预览
\n,print: 打印
\n,rename: 文件重命名
\n,saveas: 公有云适用，另存为，仅公网支持
\n,secret: 公有云适用，安全文档，仅公网支持
\n,share: 分享
\n,update: 编辑/更新
\n,upload: 上传：手动上传新版本
\nuser_id: -code: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "items": [
      {
        "permission_bits": {
          "comment": true,
          "copy": true,
          "copy_content": true,
          "delete": true,
          "download": true,
          "history": true,
          "list": true,
          "move": true,
          "new_empty": true,
          "perm_ctl": true,
          "preview": true,
          "print": true,
          "rename": true,
          "saveas": true,
          "secret": true,
          "share": true,
          "update": true,
          "upload": true
        },
        "user_id": "string"
      }
    ]
  },
  "code": 0,
  "msg": "string"
}
```