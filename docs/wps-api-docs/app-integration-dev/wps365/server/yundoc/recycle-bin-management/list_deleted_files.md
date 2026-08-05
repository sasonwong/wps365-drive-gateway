# 获取回收站文件列表

# 获取回收站文件列表

获取回收站文件列表

**标签**：`文件` `回收站` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/deleted_files          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取回收站文件列表 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询回收站(应用授权) `kso.deleted_file.read`

查询回收站(用户授权) `kso.deleted_file.read`

 |

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 否 |  | - 
| with_ext_attrs
 | `boolean` | 否 | 是否获取扩展属性 | - 
| page_size
 | `integer` | 是 | 分页大小 | - 
| page_token
 | `string` | 否 | 分页token | - 
| with_drive
 | `boolean` | 否 | 是否获取drive信息 | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
回收站文件列表响应体
company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: -,deleted_by: 回收站文件的删除者信息; 在降级场景下, deleted_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\ndrive: drive信息
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
\ndrive_id: -,dtime: -,ext_attrs: 文件扩展属性
\n,value: 属性值
\nhash: -,type: 哈希类型
\nid: -,modified_by: 回收站文件的修改者信息; 在降级场景下, modified_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nmtime: -,name: -,parent_id: -,size: -,type: \nfolder   - 文件夹
\nfile     - 文件
\nshortcut - 快捷方式
\n\n,version: -next_page_token: 下一页token
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
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
        "deleted_by": {
          "avatar": "string",
          "company_id": "string",
          "id": "string",
          "name": "string",
          "type": "user"
        },
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
        "dtime": 0,
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