# 获取单条评论

    

    

**标签**：`通用文档处理文档正文评论` 


## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **<div style="white-space: nowrap;">请求地址</div>**  | https://openapi.wps.cn/v7/documents/{file_id}/content_comments/{comment_id}          |
| **<div style="white-space: nowrap;">HTTP 方法</div>** | `GET`    |
| **<div style="white-space: nowrap;">接口描述</div>**  | 无 |
| **<div style="white-space: nowrap;">签名方式</div>**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **<div style="white-space: nowrap;">限频策略</div>** | 无 |
| **<div style="white-space: nowrap;">权限要求</div>** | <div><div>文档管理能力(应用授权) `kso.documents.readwrite`</div><div style="margin-top: 5px;"></div><div>通用文档管理能力(用户授权) `kso.documents.readwrite`</div></div> |




## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| <div style="white-space: nowrap;">file_id</div> | `string` | 是 | 文件ID | - 
| <div style="white-space: nowrap;">comment_id</div> | `string` | 是 | 评论ID | - 







## 响应体(Response)
**HTTP状态码:** `200`<br/>
**响应体格式:** `application/json`
<OpenapiRenderTable hideHeaderKeys='required' dataSource='[code: -,msg: <p>人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。</p>\n,data: -,content: <p>评论内容</p>\n,created_by: <p>评论创建者</p>\n,company_id: <p>身份所归属的公司</p>\n,id: <p>身份ID</p>\n,name: <p>用户或应用的名称</p>\n,type: <p>身份类型</p>\nctime: <p>创建时间,毫秒时间戳，评论最新创建/修改时间</p>\n,reply_id: <p>回复评论ID</p>\n]' />

## 响应体示例
```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "comment_id": "string",
    "content": "string",
    "created_by": {
      "avatar": "string",
      "company_id": "string",
      "id": "string",
      "name": "string",
      "type": "user"
    },
    "ctime": 0,
    "reply_id": "string"
  }
}
```