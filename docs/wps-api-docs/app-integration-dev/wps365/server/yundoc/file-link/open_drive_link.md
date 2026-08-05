# 开启文件盘分享

# 盘开启分享

**标签**：`文件分享` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/open_link          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 公有云适用，开启文件盘分享 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 管理驱动盘(应用授权) `kso.drive.readwrite`

管理驱动盘(用户授权) `kso.drive.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 

## 请求体(Body)
**请求体格式:** `application/json`
链接选项
check_code: 访问密码
\n,close_after_expire: 过期后取消分享链接
\n,expire_period: 过期时长
\n,expire_time: 过期时间点
\nrole_id: 权限角色
\n,scope: 链接权限范围, anyone:所有人，company:仅企业， users:指定用户。anyone仅公网支持，login_users仅私有化支持
\n,]' />

## 请求体示例
```json
{
  "opts": {
    "allow_perm_apply": true,
    "check_code": "string",
    "close_after_expire": true,
    "expire_period": 0,
    "expire_time": 0
  },
  "role_id": "string",
  "scope": "anyone"
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