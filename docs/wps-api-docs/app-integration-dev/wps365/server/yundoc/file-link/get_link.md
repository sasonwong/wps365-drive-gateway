# 获取分享链接信息

# 获取分享链接信息

获取分享链接信息

**标签**：`文件分享` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/links/{link_id}/meta          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 根据linkId获取分享链接信息 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件分享(应用授权) `kso.file_link.readwrite`

查询和管理文件分享(用户授权) `kso.file_link.readwrite`

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
| link_id
 | `string` | 是 |  | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
链接元数据
company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\ncreator: 创建者身份
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 创建时间
\n,drive_id: 盘id
\n,file_id: 文件id
\n,id: 分享id
\n,mtime: 修改时间
\n,opts: 链接设置
\n,check_code: 访问密码
\n,close_after_expire: 过期后取消分享链接
\n,expire_period: 过期时长
\n,expire_time: 过期时间点
\nrole_id: 链接权限角色id
\n,scope: 链接权限范围
\n,status: 链接状态
\n,url: 分享访问url
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "created_by": {
      "avatar": "string",
      "company_id": "string",
      "id": "string",
      "name": "string",
      "type": "user"
    },
    "ctime": 0,
    "drive_id": "string",
    "file_id": "string",
    "id": "string",
    "mtime": 0,
    "opts": {
      "allow_perm_apply": true,
      "check_code": "string",
      "close_after_expire": true,
      "expire_period": 0,
      "expire_time": 0
    },
    "role_id": "string",
    "scope": "anyone",
    "status": "open",
    "url": "string"
  },
  "code": 0,
  "msg": "string"
}
```