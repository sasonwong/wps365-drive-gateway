# 获取盘列表



**标签**：`驱动盘` 


## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **<div style="white-space: nowrap;">请求地址</div>**  | https://openapi.wps.cn/v7/drives          |
| **<div style="white-space: nowrap;">HTTP 方法</div>** | `GET`    |
| **<div style="white-space: nowrap;">接口描述</div>**  | 获取盘列表 |
| **<div style="white-space: nowrap;">签名方式</div>**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **<div style="white-space: nowrap;">限频策略</div>** | 无 |
| **<div style="white-space: nowrap;">权限要求</div>** | <div><div>管理驱动盘(应用授权) `kso.drive.readwrite`</div><div style="margin-top: 5px;"></div><div>管理驱动盘(用户授权) `kso.drive.readwrite`</div><div style="margin-top: 5px;"></div><div>MCP开放能力(用户授权) `kso.mcp.readwrite`</div></div> |


## 请求头 (Headers)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| <div style="white-space: nowrap;">X-Kso-Id-Type</div> | `string` | 否 | 类型<br>  * **internal** - 内部<br>  * **external** - 外部<br> | `internal`, `external` 





## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| <div style="white-space: nowrap;">allotee_type</div> | `string` | 是 | 盘归属身份类型，盘归属身份类型：user-获取操作者自己的私有盘列表，group-获取用户组下的盘列表, app-获取应用下的应用盘列表 | `user`, `group`, `app` 
| <div style="white-space: nowrap;">allotee_id</div> | `string` | 否 | 盘归属身份id,当allotee_type为user时，该参数仅可传操作者id(公网可不传，默认为当前操作者id)，或者可以不传默认为操作者id；当allotee_type为group时，传入group_id;当allotee_type为app时,仅传入操作应用的spid(公网可不传，默认为当前操作应用spid) | - 
| <div style="white-space: nowrap;">with_ext_attrs</div> | `boolean` | 否 | 是否获取盘扩展属性 | - 
| <div style="white-space: nowrap;">page_size</div> | `integer` | 是 | 分页大小,公网限制最大为500 | - 
| <div style="white-space: nowrap;">page_token</div> | `string` | 否 | 分页token | - 
| <div style="white-space: nowrap;">sources</div> | `array` | 否 | 盘来源，当allotee_type为user时该参数目前可多选 <br><br>          公网：special（我的云文档）、tmp（我的漫游箱）、secret（私密文件夹）、feature（签名团队）<br><br>          私网：private（我的云文档）、roaming（我的漫游箱）<br>           | - 





## 响应体(Response)
**HTTP状态码:** `200`<br/>
**响应体格式:** `application/json`
<OpenapiRenderTable hideHeaderKeys='required' dataSource='[data: <p>文件存储的介质</p>\n,allotee_type: <p>盘归属身份类型</p>\n,company_id: <p>企业id</p>\n,created_by: <p>创建者; <font color=red>在降级场景下, created_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.</font></p>\n,company_id: <p>身份所归属的公司</p>\n,id: <p>身份ID</p>\n,name: <p>用户或应用的名称</p>\n,type: <p>身份类型</p>\nctime: <p>创建时间，时间戳，单位为秒</p>\n,description: <p>盘描述</p>\n,ext_attrs: <p>盘扩展属性</p>\n,value: <p>属性值</p>\nid: <p>驱动盘id</p>\n,mtime: <p>修改时间，时间戳，单位为秒</p>\n,name: <p>驱动盘名称</p>\n,quota: <p>盘容量</p>\n,remaining: <p>剩余的总空间，以字节为单位。只读。</p>\n,total: <p>允许的总存储空间，以字节为单位。只读。</p>\n,used: <p>已使用的总空间，以字节为单位。只读。</p>\nsource: <p>盘来源</p>\n,status: <p>盘状态</p>\nnext_page_token: <p>下一页token</p>\ncode: -,msg: <p>人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。</p>\n,]' />

## 响应体示例
```json
{
  "data": {
    "items": [
      {
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
      }
    ],
    "next_page_token": "string"
  },
  "code": 0,
  "msg": "string"
}
```