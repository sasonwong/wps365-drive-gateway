# 获取异步任务信息

# 获取异步任务信息

获取异步任务信息

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drive_tasks/{task_id}/meta          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取异步任务信息 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询文件(应用授权) `kso.file.read`

查询和管理文件(用户授权) `kso.file.readwrite`

查询文件(用户授权) `kso.file.read`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| task_id
 | `string` | 是 |  | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
异步任务信息返回响应体
failed: 文件失败条数
\n,status: -,total: 文件总条数
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "done": 0,
    "failed": 0,
    "status": "string",
    "total": 0
  },
  "code": 0,
  "msg": "string"
}
```