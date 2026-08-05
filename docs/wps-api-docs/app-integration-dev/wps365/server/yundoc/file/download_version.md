# 获取指定文件版本下载地址

# 获取指定文件版本下载地址

获取指定文件版本下载地址

**标签**：`文档版本` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/versions/{version_num}/download          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取指定文件版本下载地址 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文档版本(应用授权) `kso.file_version.readwrite`

查询文档版本(应用授权) `kso.file_version.read`

查询和管理文档版本(用户授权) `kso.file_version.readwrite`

查询文档版本(用户授权) `kso.file_version.read`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 | 驱动盘id | - 
| file_id
 | `string` | 是 | 文件id | - 
| version_num
 | `integer` | 是 | 文件版本 | - 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| with_hash
 | `boolean` | 否 | 是否返回校验值 | - 
| internal
 | `boolean` | 否 | 是否返回内网下载地址，默认为false。(内部服务支持内网传输请优先走内网) | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
获取文件下载信息响应体
type: 哈希类型
\nurl: 下载地址。公网环境下，当返回地址一级域名为金山办公管理域名（wps.cn或kdocs.cn）时，调用下载地址时需要带与调用此申请地址接口相同的登录凭据（wpssid或ksosid）和设备信息凭据（wpsua或kso设备信息采集方案，若调用申请地址接口时未提供则无需提供），存储网关会进行校验。
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应体示例
```json
{
  "data": {
    "hashes": [
      {
        "sum": "string",
        "type": "sha256"
      }
    ],
    "url": "string"
  },
  "code": 0,
  "msg": "string"
}
```