# 获取文档权限角色列表

# 获取文档权限角色列表

**标签**：`文件权限角色` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/roles          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取文档权限角色列表 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件权限(应用授权) `kso.file_permission.readwrite`

查询和管理文件权限(用户授权) `kso.file_permission.readwrite`

查询文件权限(用户授权) `kso.file_permission.read`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 | drive_id表示盘id，参考 drive.list_drives接口返回的data.items[?].id | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
角色列表
name: 角色名称,展示用
\n,permission_bits: 文件操作权限
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
\npermissions: 权限
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
\ntype: 角色类型
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "items": [
      {
        "id": "string",
        "name": "string",
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
        "type": "preset"
      }
    ]
  },
  "code": 0,
  "msg": "string"
}
```