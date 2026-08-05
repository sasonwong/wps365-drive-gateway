# 获取可打标签列表

# 获取可打标签列表 

获取可打标签列表 

**标签**：`密级标签` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/sec_labels/get_available          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取可打标签列表  |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询密级标签(用户授权) `kso.secret_label_file.read`

 |

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| company_id
 | `string` | 否 | 标签所属企业,不传默认用户本企业 | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
data: -,labels: 标签列表
\n,id: 标签ID
\n,level: 标签等级
\n,name: 标签名称
\n]' >

## 响应体示例
```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "has_default_label": true,
    "labels": [
      {
        "description": "string",
        "id": "string",
        "level": 0,
        "name": "string"
      }
    ]
  }
}
```