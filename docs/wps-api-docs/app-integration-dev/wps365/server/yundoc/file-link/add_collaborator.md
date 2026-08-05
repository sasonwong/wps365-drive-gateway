# 添加分享链接协作者

# 添加分享链接协作者

## 元信息

```yaml
---
name: open_v7_add_collaborator
description: "添加分享链接协作者"
metadata:
  business_domain: "yundoc"
  updated-on: "2026-06-25"
  operation-id: "open_v7_add_collaborator"
  tags: "文件分享"
  auth-type: "app_and_user_token"
  rate-limit: "none"
  scopes: "用户授权:kso.file_link.readwrite;应用授权:kso.file_link.readwrite"
  platforms: "cn"
---
```

## API 说明

在需要为分享链接添加访问者（协作者）场景下，调用该接口添加指定用户为分享链接协作者；该协作者概念更多指文件的访问者，在使用 V7-FileID 时需调用本接口以正确匹配权限。

**注意事项：**

- 协作者类型（`type`）目前仅支持 `user` 类型。
- 当 `type` 为 `user` 时，`id` 为用户的账号ID；为 `group` 时为用户组ID；为 `dept` 时为部门ID（dept 类型为方便接入方使用）。

**使用限制：**

- 同一用户不可重复添加为分享链接协作者。

## 请求说明

| **字段** | **值** |
| --- | --- |
| **请求地址** | `https://openapi.wps.cn/v7/links/{link_id}/collaborators/add` |
| **HTTP 方法** | `POST` |
| **签名方式** | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略** | 无 |
| **权限要求** | 用户授权：`kso.file_link.readwrite`
应用授权：`kso.file_link.readwrite` |

## 请求头（Headers）

| **Header 名称** | **参数类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| Content-Type | string | 是 | `application/json` | 固定为【application/json】 | `application/json` | 内容类型，固定为 JSON 格式 |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Thu, 25 Jun 2026 10:00:00 GMT` | 请求时间，用于防重放攻击等 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 AK123456:ce8df66877175e5198c8ea1362ffddf82e4941c6f25a4ca205a1ad09d0faaf03` | KSO-1 签名值，详见 [签名方法](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证，格式为：Bearer {access_token}，获取方式详见 [认证授权概述](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/certification-authorization/summary) |

## 路径参数（Path）

| **属性名** | **类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| link_id | string | 是 | - | - | `link_example_001` | 分享链接 ID
获取接口：`open_v7_open_file_link` 返回的 `id`；`open_v7_list_send_links` 返回的 `link_id`；`open_v7_get_link` 路径参数 |

## 请求体（Body）

| **参数名称** | **参数类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| id | string | 是 | - | - | `uid_example_001` | 协作者ID；当 type 为 user 时为用户的账号ID，为 group 时为用户组ID，为 dept 时为部门ID |
| type | string | 是 | user：个人
group：普通用户组
dept：部门组
 | - | `user` | 协作者类型；目前仅支持 user 类型 |

## 请求示例

### cURL

```bash
curl -X POST "https://openapi.wps.cn/v7/links/{link_id}/collaborators/add" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -H "X-Kso-Date: Thu, 25 Jun 2026 10:00:00 GMT" \
  -H "X-Kso-Authorization: {kso1_signature}" \
  -d '{
    "id": "uid_example_001",
    "type": "user"
  }'
```

## 响应体（Response）

| **参数名称** | **参数类型** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- |
| code | integer | - | - | `0` | 错误码。非 0 表示失败 |
| msg | string | - | - | `success` | 错误描述 |
| data | object | - | - | `{}` | 业务数据（成功时为空对象） |

## 响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {}
}
```

## 错误码

| **HTTP状态码** | **错误码** | **错误描述** | **排查建议** |
| --- | --- | --- | --- |
| 400 | 400000001 | 流量超出 | 请关注限频策略信息，降低请求频率或联系客服咨询提高限频配额。 |
| 400 | 400000002 | 请求参数格式有误 | 请从msg中提取具体格式错误的请求参数信息，调整为符合限制要求后再次请求。 |
| 400 | 400000003 | 请求参数取值无效 | 请从msg中提取具体取值无效的请求参数信息，调整为符合限制要求后再次请求。注意，只能在可选值列提供的枚举中选值。 |
| 400 | 400000004 | 请求参数不支持 | 请检查请求参数名称及类型是否与接口定义一致，移除不支持的参数后重试。 |
| 400 | 400000005 | 加锁失败时返回-锁已被占用 | 目标资源正在被其他操作占用，请稍后重试。 |
| 400 | 400000006 | 释放锁失败时返回-锁已被占用或不存在 | 请确认锁是否存在或已被正确释放后重试。 |
| 400 | 400000007 | 非法参数 | 请根据 msg 中的提示检查并调整请求参数后重试。 |
| 400 | 400000101 | 集合为空 | 请确保请求中集合类型参数至少包含一项。 |
| 400 | 400000102 | 集合不为空 | 请确保目标集合为空后再执行该操作。 |
| 400 | 400000103 | 资源不存在 | 请确认所引用的资源 ID 是否正确且资源存在。 |
| 400 | 400000104 | 资源已经存在 | 目标资源已存在，请勿重复创建。 |
| 400 | 400000105 | 数目限制超出 | 请减少请求中的条目数量，使其符合接口限制后重试。 |
| 400 | 400000106 | 长度限制超出 | 请从msg中提取具体超长的请求参数信息，调整为符合限制要求后再次请求。 |
| 400 | 400000201 | 客户端其他错误 | 请检查请求构造是否正确，根据 msg 提示调整后重试。 |
| 400 | 400353001 | 链接id非法 | 请确认 link_id 格式正确，参考获取接口说明重新获取有效的分享链接 ID。 |
| 400 | 400353010 | 链接不存在 | 请确认 link_id 是否正确，可通过 `open_v7_list_send_links` 核实分享是否存在。 |
| 401 | 401000001 | 终端用户令牌认证错误或者开发这签名验证错误 | 请检查 access_token 是否有效，以及 KSO-1 签名是否正确，参考签名文档重新构造请求。 |
| 403 | 403000001 | 无权限 | 请确认应用或用户已授予 `kso.file_link.readwrite` 权限，且对目标分享链接具有操作权限。 |
| 403 | 403000002 | 策略判定拒绝 | 企业安全策略拒绝了该操作，请联系管理员确认策略配置。 |
| 403 | 403008003 | 分享链接成员已存在 | 该用户已是分享链接成员，无需重复添加。 |
| 403 | 403008010 | 不是分享链接成员 | 当前用户不是该分享链接的成员，无法执行该操作。 |
| 404 | 404353001 | 链接不存在 | 请确认 link_id 是否正确，可通过 `open_v7_list_send_links` 核实分享是否存在。 |
| 415 | 415000001 | 不支持的ContentType | 固定使用application/json，暂不支持其他枚举。 |
| 429 | 429000001 | 请求太频繁 | 请勿频繁重试请求，关注限频策略信息，降低请求频率或联系客服咨询提高限频。 |
| 499 | 499000001 | 请求被取消 | 客户端取消了请求，请重新发起请求。 |
| 500 | 500000002 | 断路器已打开 | 服务熔断，请勿频繁重试请求，建议5分钟后重试或立即联系客服人员。 |
| 500 | 500000003 | 存储服务错误 | 存储服务异常，请稍后重试或联系客服人员。 |
| 500 | 500000004 | 服务端其他错误 | 服务熔断，请勿频繁重试请求，建议10分钟后重试或立即联系客服人员。 |
| 503 | 503000001 | 服务数据升级中 | 服务正在数据升级中，请稍后重试。 |
