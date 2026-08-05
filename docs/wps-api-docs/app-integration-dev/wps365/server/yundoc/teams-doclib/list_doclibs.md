# 获取文档库列表

# 获取团队文档库列表

获取文档库（团队文档）列表

**标签**：`文档库` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/doclibs          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取文档库(团队文档)列表 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文档库(应用授权) `kso.doclib.readwrite`

查询和管理文档库(用户授权) `kso.doclib.readwrite`

查询文档库(用户授权) `kso.doclib.read`

 |

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| page_size
 | `integer` | 是 | 分页大小,公网上限是100 | - 
| page_token
 | `string` | 否 | 分页token | - 
| user_role
 | `array` | 否 | 按用户在文档库对应用户组的角色筛选组,按ctime返回,置顶不生效 | `readonly`, `normal`, `admin`, `owner` 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
获取团队文档库列表响应体
allotee_type: 盘归属身份类型
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
\ngroup: 文档库用户组信息
\n,company_id: 组织ID
\n,creator_id: 创建者ID 创建时即确定，不被修改。
\n,ctime: 创建时间
\n,dept_id: 关联部门ID, 默认 0
\n,description: 描述介绍
\n,id: 组ID
\n,mail: 邮箱信息
\n,member_total: 成员数量
\n,mtime: 更新时间
\n,name: 名称
\n,owner_id: 拥有者ID
\n,source: 用户组的引用业务方
\n,status: 状态
\n,type: 类型
\npinned: 是否置顶
\n,user_role: 当前成员信息
\nnext_page_token: 下一页token
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "items": [
      {
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
        "group": {
          "avatar": "string",
          "company_id": "string",
          "creator_id": "string",
          "ctime": 0,
          "dept_id": "string",
          "description": "string",
          "id": "string",
          "mail": "string",
          "member_total": 0,
          "mtime": 0,
          "name": "string",
          "owner_id": "string",
          "source": "string",
          "status": "enable",
          "type": "normal"
        },
        "pinned": true,
        "user_role": "readonly"
      }
    ],
    "next_page_token": "string"
  },
  "code": 0,
  "msg": "string"
}
```