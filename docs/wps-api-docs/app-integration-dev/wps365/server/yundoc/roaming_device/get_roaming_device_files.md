# 获取设备下的漫游文件列表

# 获取设备下的漫游文件列表

## API 说明

获取设备下的漫游文件列表。

**注意事项：**

- 在降级场景下，`created_by.type` 和 `modified_by.type` 可能返回 `unknown`，业务侧需做好兼容处理。

**使用限制：**

- `page_size` 默认 `20`，公网最大 `200`。
- 个人漫游设备文件 `order_by` 仅支持 `mtime`、`fsize`。
- `filter_exts` 需传小写扩展名，多个扩展名用英文逗号分隔，不加空格。

## 请求说明

| 字段 | 值 |
| --- | --- |
| 请求地址 | `https://openapi.wps.cn/v7/roaming_devices/{device_id}/files` |
| HTTP 方法 | `GET` |
| 签名方式 | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| 限频策略 | 无 |
| 权限要求 | 应用授权：`kso.file.readwrite`
应用授权：`kso.file.read`
用户授权：`kso.file.readwrite`
用户授权：`kso.file.read` |

## 请求头（Headers）

| Header 名称 | 参数类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Thu, 25 Jun 2026 08:23:00 GMT` | 请求时间，用于签名校验 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 {access_key}:{signature}` | KSO-1 签名值 |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证 |

## 路径参数（Path）

| 属性名 | 类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| device_id | string | 是 | - | - | `roaming_device_v2_xxx` | 漫游设备 ID，`roaming_device_V2.id` |

## 查询参数（Query）

| 属性名 | 类型 | 是否必填 | 可选值 | 限制 | 示例 | 描述 |
| --- | --- | --- | --- | --- | --- | --- |
| page_size | integer | 否 | - | 默认 `20`，公网最大 `200` | `20` | 分页大小 |
| page_token | string | 否 | - | - | `next_token_xxx` | 分页 token |
| order | string | 否 | `desc`：降序
`asc`：升序 | - | `desc` | 排序方式 |
| order_by | string | 否 | `ctime`
`mtime`
`dtime`
`fname`
`fsize` | 个人漫游设备仅支持 `mtime`、`fsize` | `mtime` | 排序字段 |
| filter_exts | string | 否 | - | 扩展名小写，英文逗号分隔，不传或空串表示不过滤 | `docx,xlsx,pdf` | 扩展名过滤条件 |

## 请求示例

```bash
curl -X GET "https://openapi.wps.cn/v7/roaming_devices/{device_id}/files?page_size=20&order=desc&order_by=mtime&filter_exts=docx,xlsx" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "X-Kso-Date: Thu, 25 Jun 2026 08:23:00 GMT" \
  -H "X-Kso-Authorization: {{kso1_signature}}"
```

## 响应体（Response）
**HTTP状态码:** `200`

**响应体格式:** `application/json`
文件列表
company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 文件创建时间，时间戳，单位为秒
\n,drive: 文件驱动盘具体信息，默认不返回，入参中有with_drive参数时可控制
\n,allotee_type: 盘归属身份类型
\n,bucket: 私有云适用，私网应用文档专属；盘存储的bucket位置
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
\nhash: 私有云适用，文件散列值。公网不返回此参数
\n,type: 哈希类型
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
\nshared: 公有云适用，是否开启分享，当link.status = 'open’时，shared为true，其他结果为false。若调用方想提前知道文档是否分享但又不想额外调用分享信息，可使用此字段
\n,size: 文件大小
\n,type: 文件类型
\n,version: 文件版本
\nnext_page_token: 下一页token
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应示例

```json
{
  "data": {
    "items": [
      {
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
          "bucket": "string",
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
        "hash": {
          "sum": "string",
          "type": "sha256"
        },
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
      }
    ],
    "next_page_token": "string"
  },
  "code": 0,
  "msg": "string"
}
```

## 错误码

| **HTTP状态码** | **错误码** | **错误描述** | **排查建议** |
| --- | --- | --- | --- |
| 400 | 400000004 | 请求参数不支持 | 请检查请求参数是否正确 |

