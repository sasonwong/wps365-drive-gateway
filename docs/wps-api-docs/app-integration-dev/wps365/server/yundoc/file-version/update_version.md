# 更新文件版本信息

# 更新文件版本信息

更新文件版本信息

**标签**：`文档版本` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/versions/{version_num}/update          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 更新文件版本信息 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文档版本(应用授权) `kso.file_version.readwrite`

查询和管理文档版本(用户授权) `kso.file_version.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 
| file_id
 | `string` | 是 |  | - 
| version_num
 | `integer` | 是 |  | - 

## 请求体(Body)
**请求体格式:** `application/json`
版本备注
ext_attrs: 版本扩展属性
\n,value: 属性值
\n]' />

## 请求体示例
```json
{
  "comment": "string",
  "ext_attrs": [
    {
      "name": "string",
      "value": "string"
    }
  ]
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
历史版本信息
created_by: 历史版本的创建者信息; 在降级场景下, created_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 文件创建时间，时间戳，单位为秒
\n,ext_attrs: 版本扩展属性
\n,value: 属性值
\nfile_id: 文件id
\n,hash: -,type: 哈希类型
\nid: -,modified_by: 历史版本的修改者信息; 在降级场景下, modified_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nmtime: 文件修改时间，时间戳，单位为秒
\n,size: 文件大小
\n,version: 文件版本
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "comment": "string",
    "created_by": {
      "avatar": "string",
      "company_id": "string",
      "id": "string",
      "name": "string",
      "type": "user"
    },
    "ctime": 0,
    "ext_attrs": [
      {
        "name": "string",
        "value": "string"
      }
    ],
    "file_id": "string",
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
    "size": 0,
    "version": 0
  },
  "code": 0,
  "msg": "string"
}
```