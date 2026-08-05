# 二级回收站批量文件删除

# 二级回收站批量文件删除

二级回收站批量文件删除, 删除目的地由 delete_type 参数设置，仅支持指定为下一级为 permanent

**标签**：`文件` `回收站` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/second_deleted_files/batch_delete          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 二级回收站批量文件删除, 删除目的地由delete_type参数设置,仅支持指定为下一级为permanent |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理回收站(应用授权) `kso.deleted_file.readwrite`

查询和管理回收站(用户授权) `kso.deleted_file.readwrite`

 |

## 请求体(Body)
**请求体格式:** `application/json`
删除操作时可以指定删除到的目标位置
file_ids: -,]' />

## 请求体示例
```json
{
  "delete_type": "first",
  "file_ids": [
    "string"
  ]
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
批量任务响应体
code: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "task_id": "string"
  },
  "code": 0,
  "msg": "string"
}
```