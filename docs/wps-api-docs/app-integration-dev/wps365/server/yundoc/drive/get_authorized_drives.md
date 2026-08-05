# 获取已授权的盘列表

# 获取已授权的盘列表

## API 说明

在需要查询当前操作者（应用身份）已获授权可访问的驱动盘场景下，调用该接口可根据操作者授权记录获取盘列表，用于盘选择、权限校验前的资源枚举等。

**注意事项：**

- 本接口返回的是操作者**已获授权**的盘，与「获取盘列表」接口（按归属身份 `allotee_type`/`allotee_id` 查询）的筛选维度不同。
- 当 `created_by.type` 为 `unknown` 时，表示降级场景下未能解析身份类型，业务方使用 `type` 字段时需做降级处理。
- `page_token` 仅可使用上一页响应中的 `next_page_token`，请勿自行拼接或篡改。

**使用限制：**

- `page_size` 取值范围为 1～100，超出范围将返回参数错误。
- `with_ext_attrs` 为 `true` 时才会返回盘扩展属性 `ext_attrs`；默认不返回。
- `bucket` 字段为私网应用文档专属字段，公网环境可能不返回。

## 请求说明

| **字段** | **值** |
| --- | --- |
| **请求地址** | **https://openapi.wps.cn/v7/drives/authorized** |
| **HTTP 方法** | `GET` |
| **签名方式** | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略** | 遵循开放平台默认限频策略 |
| **权限要求** | 用户授权：`kso.drive.readwrite`
应用授权：`kso.drive.readwrite` |

## 请求头（Headers）

| **Header 名称** | **参数类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| X-Kso-Id-Type | string | 否 | internal：内部 ID
external：外部 ID
 | - | `internal` | 开放 ID 类型，默认 internal，目前仅用户 ID 和部门 ID 存在转换 |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Thu, 23 Jul 2026 02:00:00 GMT` | 请求时间，用于防重放攻击等 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 AK123456:ce8df66877175e5198c8ea1362ffddf82e4941c6f25a4ca205a1ad09d0faaf03` | KSO-1 签名值，详见 [签名方法](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证，格式为：`Bearer {access_token}`，获取方式详见 [认证授权概述](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/certification-authorization/summary) |

## 查询参数（Query）

| **属性名** | **类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| with_ext_attrs | boolean | 否 | `true`, `false` | - | `true` | 是否获取盘扩展属性；为 `true` 时响应中返回 `ext_attrs` |
| page_size | integer | 是 | - | 取值范围[1,100] | `20` | 分页大小，最大支持 100 |
| page_token | string | 否 | - | - | `demo_page_token` | 分页 token，首页可不传；翻页时传入上一页返回的 `next_page_token` |

## 请求示例

### cURL

```bash
curl -X GET "https://openapi.wps.cn/v7/drives/authorized?page_size=20&with_ext_attrs=true&page_token=demo_page_token" \
  -H "Authorization: Bearer {access_token}" \
  -H "X-Kso-Id-Type: internal" \
  -H "X-Kso-Date: Thu, 23 Jul 2026 02:00:00 GMT" \
  -H "X-Kso-Authorization: {kso1_signature}"
```

### Python

```python
import requests

url = "https://openapi.wps.cn/v7/drives/authorized"
headers = {
    "Authorization": "Bearer {access_token}",
    "X-Kso-Id-Type": "internal",
    "X-Kso-Date": "Thu, 23 Jul 2026 02:00:00 GMT",
    "X-Kso-Authorization": "{kso1_signature}",
}
params = {
    "page_size": 20,
    "with_ext_attrs": True,
    "page_token": "demo_page_token",
}
resp = requests.get(url, headers=headers, params=params)
print(resp.json())
```

## 响应体（Response）

| **参数名称** | **参数类型** | **可选值** | **限制** | **描述** |
| --- | --- | --- | --- | --- |
| code | integer | - | - | 错误码。非 0 表示失败，成功为 0 |
| msg | string | - | - | 错误描述，成功时一般为 `success` |
| data | object | - | - | 业务数据 |
| ∟ items | array[object] | - | - | 已授权的盘列表 |
| ∟ ∟ id | string | - | - | 驱动盘 ID。可通过本接口或「获取盘列表」「新建驱动盘」等接口获取 |
| ∟ ∟ name | string | - | - | 驱动盘名称 |
| ∟ ∟ allotee_type | string | user：用户
group：用户组
app：应用
 | - | 盘归属身份类型 |
| ∟ ∟ allotee_id | string | - | - | 盘归属身份 ID。`user` 为用户 ID，`group` 为用户组 ID，`app` 为应用 spid |
| ∟ ∟ company_id | string | - | - | 企业 ID，盘所属企业标识 |
| ∟ ∟ created_by | object | - | - | 创建者身份信息。在降级场景下，created_by 的 type 字段会返回 unknown。业务方如果使用到 type 字段，需要在 type 为 unknown 时作降级处理。 |
| ∟ ∟ ∟ id | string | - | - | 创建者身份 ID（用户 ID 或服务主体 ID） |
| ∟ ∟ ∟ type | string | user：用户
sp：服务主体
unknown：未知；异常场景无法获取 type 时的降级值
 | - | 创建者身份类型 |
| ∟ ∟ ∟ name | string | - | - | 用户或应用的名称 |
| ∟ ∟ ∟ avatar | string | - | - | 用户或应用的头像 URL |
| ∟ ∟ ∟ company_id | string | - | - | 创建者身份所属企业 ID |
| ∟ ∟ ctime | integer | - | - | 创建时间，秒级时间戳 |
| ∟ ∟ mtime | integer | - | - | 修改时间，秒级时间戳 |
| ∟ ∟ description | string | - | - | 驱动盘描述信息 |
| ∟ ∟ quota | object | - | - | 驱动盘容量信息（只读） |
| ∟ ∟ ∟ total | integer | - | - | 允许的总存储空间，以字节为单位。只读。 |
| ∟ ∟ ∟ used | integer | - | - | 已使用的总空间，以字节为单位。只读。 |
| ∟ ∟ ∟ remaining | integer | - | - | 剩余的总空间，以字节为单位。只读。 |
| ∟ ∟ ∟ deleted | integer | - | - | 回收站中的文件占用的总空间，以字节为单位。只读。 |
| ∟ ∟ status | string | inuse：使用中
deleted：已删除
 | - | 驱动盘状态 |
| ∟ ∟ ext_attrs | array[object] | - | - | 盘扩展属性列表；仅当请求 `with_ext_attrs=true` 时返回 |
| ∟ ∟ ∟ name | string | - | - | 扩展属性名称 |
| ∟ ∟ ∟ value | string | - | - | 扩展属性值 |
| ∟ ∟ source | string | - | - | 盘来源标识。默认 `yundoc`；公网常见值含 special/tmp/secret/feature，私网常见值含 private/roaming |
| ∟ ∟ bucket | string | - | - | 私网应用文档专属；盘存储的 bucket 位置 |
| ∟ next_page_token | string | - | - | 下一页 token；无更多数据时为空或不返回 |

## 响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "items": [
      {
        "id": "drive_example_001",
        "name": "示例驱动盘",
        "allotee_type": "user",
        "allotee_id": "uid_example_001",
        "company_id": "company_example_001",
        "created_by": {
          "id": "uid_example_001",
          "type": "user",
          "name": "示例用户",
          "avatar": "https://example.com/avatar.png",
          "company_id": "company_example_001"
        },
        "ctime": 1682000000,
        "mtime": 1682000000,
        "description": "这是一段示例描述",
        "quota": {
          "total": 10737418240,
          "used": 1073741824,
          "remaining": 9663676416,
          "deleted": 0
        },
        "status": "inuse",
        "ext_attrs": [
          {
            "name": "demo_attr",
            "value": "demo_value"
          }
        ],
        "source": "yundoc",
        "bucket": "demo_bucket"
      }
    ],
    "next_page_token": "demo_page_token"
  }
}
```

## 错误码

| **HTTP状态码** | **错误码** | **错误描述** | **排查建议** |
| --- | --- | --- | --- |
| 400 | 400000001 | 流量超出 | 当前请求触发流量限制，请降低请求频率后重试，或联系客服调整配额。 |
| 400 | 400000002 | 请求参数格式有误 | 请从msg中提取具体格式错误的请求参数信息，调整为符合限制要求后再次请求。 |
| 400 | 400000003 | 请求参数取值无效 | 请从msg中提取具体取值无效的请求参数信息，调整为符合限制要求后再次请求。注意，只能在可选值列提供的枚举中选值。常见原因：`page_size` 不在 1～100，或 `page_token` 非法。 |
| 400 | 400000004 | 请求参数不支持 | 请检查是否传入了接口不支持的参数或参数组合，移除后重试。 |
| 400 | 400000005 | 加锁失败时返回-锁已被占用 | 目标资源正被锁定，请稍后重试。 |
| 400 | 400000006 | 释放锁失败时返回-锁已被占用或不存在 | 确认锁状态与持有方是否匹配，必要时重新获取锁后再操作。 |
| 400 | 400000007 | 非法参数 | 检查必填参数是否缺失、类型是否正确（如 `page_size` 是否为正整数）。 |
| 400 | 400000101 | 集合为空 | 确认请求的集合类参数不为空后再重试。 |
| 400 | 400000102 | 集合不为空 | 确认请求场景要求集合为空时，不要传入非空集合。 |
| 400 | 400000103 | 资源不存在 | 确认目标资源 ID 是否正确且仍存在。 |
| 400 | 400000104 | 资源已经存在 | 避免重复创建已存在的资源，或改为更新操作。 |
| 400 | 400000105 | 数目限制超出 | 减少单次请求的条目数量后重试。 |
| 400 | 400000106 | 长度限制超出 | 请从msg中提取具体超长的请求参数信息，调整为符合限制要求后再次请求。 |
| 400 | 400000201 | 客户端其他错误 | 检查请求参数与调用方式，仍失败请携带 request_id 联系技术支持。 |
| 403 | 403000001 | 无权限 | 确认 access_token 已具备 `kso.drive.readwrite` 用户授权或应用授权，且应用对目标盘有访问权限。 |
| 403 | 403000002 | 策略判定拒绝 | 请求被安全/权限策略拦截，请联系企业管理员确认策略配置。 |
| 415 | 415000001 | 不支持的ContentType | 固定使用application/json，暂不支持其他枚举。 |
| 429 | 429000001 | 请求太频繁 | 请勿频繁重试请求，关注限频策略信息，降低请求频率或联系客服咨询提高限频。 |
| 499 | 499000001 | 请求被取消 | 客户端或网关取消了请求，请检查超时设置后重试。 |
| 500 | 500000002 | 断路器已打开 | 服务熔断，请勿频繁重试请求，建议5分钟后重试或立即联系客服人员。 |
| 500 | 500000003 | 存储服务错误 | 存储后端异常，请稍后重试；持续失败请联系技术支持。 |
| 500 | 500000004 | 服务端其他错误 | 服务熔断，请勿频繁重试请求，建议10分钟后重试或立即联系客服人员。 |
| 503 | 503000001 | 服务数据升级中 | 服务正在数据升级，请稍后重试。 |
