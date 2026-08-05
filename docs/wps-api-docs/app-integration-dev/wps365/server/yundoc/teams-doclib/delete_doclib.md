# 删除文档库

# 删除文档库

删除文档库（团队文档)

**标签**：`文档库` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/doclib/delete          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 删除文档库(团队文档) |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文档库(应用授权) `kso.doclib.readwrite`

查询和管理文档库(用户授权) `kso.doclib.readwrite`

 |

## 请求体(Body)
**请求体格式:** `application/json`
文档库驱动盘id
]' />

## 请求体示例
```json
{
  "drive_id": "string"
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
]' />

## 响应体示例
```json
{
  "code": 0,
  "msg": "string"
}
```