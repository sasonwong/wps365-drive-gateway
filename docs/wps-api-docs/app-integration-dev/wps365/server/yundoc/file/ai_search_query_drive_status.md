# 获取团队整体入库状态

# 查询驱动盘AI搜索状态

**标签**：`文件智能搜索` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/files/ai_search/query_drive_status          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 用于开启智能搜索后，获取团队整体入库状态 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 搜索文件(应用授权) `kso.file.search`

搜索文件(用户授权) `kso.file_search.readwrite`

搜索文件(用户授权) `kso.file.search`

 |

## 请求体(Body)
**请求体格式:** `application/json`
要查询的盘
mode: 操作业务：文档库drive(默认)、我的云文档private、我的设备temp、共享列表share、最近列表roaming
\n,scene: 场景：ai_qa(ai问答)，ai_graphic(图谱)
\n,]' />

## 请求体示例
```json
{
  "drive_ids": [
    "string"
  ],
  "mode": "drive",
  "scene": "ai_search"
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
获取团队整体入库状态返回数据
not_support_cnt: 不支持文件的数量
\n,succ_cnt: 成功的数量
\n,to_update_cnt: 待更新的数量
\n,updating_cnt: 正在更新的数量
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "failed_cnt": 0,
    "not_support_cnt": 0,
    "succ_cnt": 0,
    "to_update_cnt": 0,
    "updating_cnt": 0
  },
  "code": 0,
  "msg": "string"
}
```