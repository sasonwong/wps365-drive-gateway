# 申请文件权限

# 申请文件权限

## 元信息

```yaml
---
name: open_v7_apply_file_permission
description: "申请文件权限"
metadata:
  business_domain: "yundoc"
  updated-on: "2026-06-25"
  operation-id: "open_v7_apply_file_permission"
  tags: "文件权限"
  auth-type: "app_and_user_token"
  rate-limit: "none"
  scopes: "用户授权:kso.file_permission.readwrite;应用授权:kso.file_permission.readwrite"
  platforms: "cn"
---
```

## API 说明

在需要对无权限文件申请访问权限场景下，调用该接口向文件管理者发起权限申请。

**注意事项：**

- 申请权限类型（`role_name`）支持预览（view）、评论（comment）、编辑（edit）三种预置角色。
- 审批流程需由文件管理者通过 `open_v7_approve_file_permission` 接口处理。

**使用限制：**

- 备注（`remark`）字符长度为 0~100。

## 请求说明

| **字段** | **值** |
| --- | --- |
| **请求地址** | `https://openapi.wps.cn/v7/files/{file_id}/permissions/apply` |
| **HTTP 方法** | `POST` |
| **签名方式** | [KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略** | 无 |
| **权限要求** | 用户授权：`kso.file_permission.readwrite`
应用授权：`kso.file_permission.readwrite` |

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
| file_id | string | 是 | - | - | `file_example_001` | 文件id，参考 `open_v7_list_file` 接口返回的 items[?].id |

## 请求体（Body）

| **参数名称** | **参数类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| role_name | string | 是 | view：预览
comment：评论
edit：编辑
 | - | `view` | 申请权限 |
| remark | string | 否 | - | 字符长度[0,100] | `这是一段示例描述` | 备注 |

## 请求示例

### cURL

```bash
curl -X POST "https://openapi.wps.cn/v7/files/{file_id}/permissions/apply" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -H "X-Kso-Date: Thu, 25 Jun 2026 10:00:00 GMT" \
  -H "X-Kso-Authorization: {kso1_signature}" \
  -d '{
    "role_name": "view",
    "remark": "这是一段示例描述"
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
| 400 | 400352017 | 权限审批消息非法 | 请检查申请参数（role_name、remark）格式是否符合接口要求。 |
| 400 | 400352018 | 权限申请已审批 | 该文件的权限申请已处理完毕，无需重复提交申请。 |
| 400 | 400352019 | 申请人不在该企业 | 申请人须为文件所属企业的成员，请确认当前用户企业归属。 |
| 400 | 400353002 | 文件id非法 | 请确认 file_id 格式正确，参考 `open_v7_list_file` 重新获取有效的文件 ID。 |
| 400 | 400353011 | 文件不存在 | 请确认 file_id 对应的文件是否存在且未被删除。 |
| 401 | 401000001 | 终端用户令牌认证错误或者开发这签名验证错误 | 请检查 access_token 是否有效，以及 KSO-1 签名是否正确，参考签名文档重新构造请求。 |
| 403 | 403000001 | 无权限 | 请确认应用或用户已授予 `kso.file_permission.readwrite` 权限。 |
| 403 | 403000002 | 策略判定拒绝 | 企业安全策略拒绝了该操作，请联系管理员确认策略配置。 |
| 403 | 403352001 | 操作非法,服务器拒绝执行 | 当前用户无权对该文件发起权限申请，请确认文件访问状态。 |
| 415 | 415000001 | 不支持的ContentType | 固定使用application/json，暂不支持其他枚举。 |
| 429 | 429000001 | 请求太频繁 | 请勿频繁重试请求，关注限频策略信息，降低请求频率或联系客服咨询提高限频。 |
| 499 | 499000001 | 请求被取消 | 客户端取消了请求，请重新发起请求。 |
| 500 | 500000002 | 断路器已打开 | 服务熔断，请勿频繁重试请求，建议5分钟后重试或立即联系客服人员。 |
| 500 | 500000003 | 存储服务错误 | 存储服务异常，请稍后重试或联系客服人员。 |
| 500 | 500000004 | 服务端其他错误 | 服务熔断，请勿频繁重试请求，建议10分钟后重试或立即联系客服人员。 |
| 503 | 503000001 | 服务数据升级中 | 服务正在数据升级中，请稍后重试。 |
