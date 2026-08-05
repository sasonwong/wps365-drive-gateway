# 文件搜索

# 文件搜索

**标签**：`搜索文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/files/search          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 文件搜索 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 搜索文件(应用授权) `kso.file.search`

搜索文件(用户授权) `kso.file_search.readwrite`

搜索文件(用户授权) `kso.file.search`

MCP开放能力(用户授权) `kso.mcp.readwrite`

 |

## 请求头 (Headers)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| X-Kso-Id-Type
 | `string` | 否 | 类型
  * **internal** - 内部
  * **external** - 外部
 | `internal`, `external` 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| keyword
 | `string` | 否 | 搜索关键字 | - 
| type
 | `string` | 是 | 搜索类型 | `file_name`, `content`, `all` 
| file_type
 | `string` | 否 | 文件类型,不传默认全搜 | `folder`, `file`, `shortcut` 
| file_exts
 | `array` | 否 | 文件后缀 | - 
| drive_ids
 | `array` | 否 | 搜索盘列表,v7接口支持数组,但是还没有应用场景 | - 
| parent_ids
 | `array` | 否 | 搜索目录列表 | - 
| creator_ids
 | `array` | 否 | 创建者id,公网只支持选择是否自己创建的文件 | - 
| modifier_ids
 | `array` | 否 | 编辑者id | - 
| sharer_ids
 | `array` | 否 | 分享者id | - 
| receiver_ids
 | `array` | 否 | 接收者id | - 
| time_type
 | `string` | 否 | 时间范围 | `ctime`, `mtime`, `otime`, `stime` 
| start_time
 | `integer` | 否 | 最小时间 | - 
| end_time
 | `integer` | 否 | 最大时间 | - 
| with_permission
 | `boolean` | 否 | 是否返回文件操作权限 | - 
| with_link
 | `boolean` | 否 | 是否返回文件分享信息 | - 
| with_total
 | `boolean` | 否 | 是否返回搜索到的总条数 | - 
| page_size
 | `integer` | 是 | 分页大小,公网限制最大为500 | - 
| page_token
 | `string` | 否 | 翻页token | - 
| channels
 | `array` | 否 | 渠道信息 | - 
| device_ids
 | `array` | 否 | 设备id | - 
| exclude_channels
 | `array` | 否 | 排除渠道信息 | - 
| exclude_file_exts
 | `array` | 否 | 排除文件后缀 | - 
| filter_user_id
 | `integer` | 否 | 创建者分享者过滤 | - 
| file_ext_groups
 | `array` | 否 | 文件分组后缀 | - 
| with_folder
 | `boolean` | 否 | 是否返回文件夹文件, 已过期, 使用file_type字段实现 | - 
| with_drive
 | `boolean` | 否 | 是否返回驱动盘 | - 
| order
 | `string` | 否 | 排序方式 | `desc`, `asc` 
| order_by
 | `string` | 否 | 排序字段 | `ctime`, `mtime` 
| scope
 | `array` | 否 | 搜索范围 | `all`, `share_by_me`, `share_to_me`, `latest`, `personal_drive`, `group_drive`, `recycle`, `customize`, `latest_opened`, `latest_edited` 
| search_operator_name
 | `boolean` | 否 | 搜索文件的创建者或文件分享者 | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
数据集合
company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 文件创建时间，时间戳，单位为秒
\n,drive: 文件驱动盘具体信息，默认不返回，入参中有with_drive参数时可控制
\n,allotee_type: 盘归属身份类型
\n,company_id: 企业id
\n,created_by: 创建者; 在降级场景下, created_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 创建时间，时间戳，单位为秒
\n,description: 盘描述
\n,ext_attrs: 盘扩展属性
\n,value: 属性值
\nid: 驱动盘id
\n,mtime: 修改时间，时间戳，单位为秒
\n,name: 驱动盘名称
\n,quota: 盘容量
\n,remaining: 剩余的总空间，以字节为单位。只读。
\n,total: 允许的总存储空间，以字节为单位。只读。
\n,used: 已使用的总空间，以字节为单位。只读。
\nsource: 盘来源
\n,status: 盘状态
\ndrive_id: 驱动盘id
\n,ext_attrs: 文件扩展属性
\n,value: 属性值
\nid: 文件id
\n,link_id: 分享id
\n,link_url: 分享链接url
\n,modified_by: 文件修改者信息; 在降级场景下, modified_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nmtime: 文件修改时间，时间戳，单位为秒
\n,name: 文件名
\n,parent_id: 父目录id
\n,permission: 文件权限，默认不返回，入参中有with_permission参数时可控制
\n,copy: 复制
\n,copy_content: 内容复制
\n,delete: 文件删除
\n,download: 下载
\n,history: 历史版本，仅公网支持
\n,list: 列表
\n,move: 文件移动
\n,new_empty: 新建
\n,perm_ctl: 权限管理
\n,preview: 预览
\n,print: 打印
\n,rename: 文件重命名
\n,saveas: 另存为，仅公网支持
\n,secret: 安全文档，仅公网支持
\n,share: 分享
\n,update: 编辑/更新
\n,upload: 上传：手动上传新版本
\nshared: 是否开启分享，当link.status = 'open’时，shared为true，其他结果为false。若调用方想提前知道文档是否分享但又不想额外调用分享信息，可使用此字段
\n,size: 文件大小
\n,type: 文件类型
\n,version: 文件版本
\nfile_src: 文件位置
\n,path: 文件路径
\n,type: 来源类型
\nhighlights: 匹配关键字
\n,otime: 文件打开时间
\nnext_page_token: 下一页token
\n,total: 资源集合总数
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "items": [
      {
        "file": {
          "created_by": {
            "avatar": "string",
            "company_id": "string",
            "id": "string",
            "name": "string",
            "type": "user"
          },
          "ctime": 0,
          "drive": {
            "allotee_id": "string",
            "allotee_type": "user",
            "company_id": "string",
            "created_by": {
              "avatar": "string",
              "company_id": "string",
              "id": "string",
              "name": "string",
              "type": "user"
            },
            "ctime": 0,
            "description": "string",
            "ext_attrs": [
              {
                "name": "string",
                "value": "string"
              }
            ],
            "id": "string",
            "mtime": 0,
            "name": "string",
            "quota": {
              "deleted": 0,
              "remaining": 0,
              "total": 0,
              "used": 0
            },
            "source": "string",
            "status": "inuse"
          },
          "drive_id": "string",
          "ext_attrs": [
            {
              "name": "string",
              "value": "string"
            }
          ],
          "id": "string",
          "link_id": "string",
          "link_url": "string",
          "modified_by": {
            "avatar": "string",
            "company_id": "string",
            "id": "string",
            "name": "string",
            "type": "user"
          },
          "mtime": 0,
          "name": "string",
          "parent_id": "string",
          "permission": {
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
          "shared": true,
          "size": 0,
          "type": "folder",
          "version": 0
        },
        "file_src": {
          "name": "string",
          "path": "string",
          "type": "link"
        },
        "highlights": {
          "example_key": [
            "string"
          ]
        },
        "otime": 0
      }
    ],
    "next_page_token": "string",
    "total": 0
  },
  "code": 0,
  "msg": "string"
}
```