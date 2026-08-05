# 通用参数

为了满足多样化的应用场景，WPS 开放平台提供了丰富的 API 和事件，供开发者调用或订阅。这些 API 和事件会涉及到一些通用参数，在此进行统一介绍。通用参数可能作为请求参数，也可能作为响应参数。在使用 WPS 开放平台提供的 API 和事件之前，建议先了解一下这些通用参数的含义。

## 应用相关

**APPID**：简称 AK，WPS 开放平台应用的唯一标识。在创建应用时，由系统自动生成，用户不能自行修改。可在`开发者后台-应用信息`处查看。

**APPKEY**：简称 SK，与 APPID 为 1 对 1 配对关系，在创建应用时，由系统自动生成。在调用某些 API 时，需要将其作为请求参数之一。APPKEY 可以重置，重置后，原 APPKEY 将失效，开发者应注意更新调用入参以免调用失败。

**app_ticket**： WPS 开放平台通过 APP 的事件订阅地址定时推送给 APP 服务端的一个短期有效凭证，是第三方企业应用获取访问凭证的必要参数之一。应用需主动调用[推送 app_ticket](/app-integration-dev/wps365/server/certification-authorization/get-token/push-app-ticket)接口来激活该事件推送，WPS 开放平台每隔一段时间（不定期）会推送一次最新 app_ticket。开发者使用时无需关注 ticket 的有效期，用最新收到的 ticket 即可。另外，若事件连续 5 次未被应用响应或响应错误，平台将停止推送，应用需重新调用上述接口再次激活事件推送。

## 企业相关

**company_id**：企业唯一标识。应用有如下两种方式获取 company_id：

- 企业安装应用时，开放平台会通过[应用授权状态变更](/app-integration-dev/wps365/server/app/event/authorize-update)推送给应用。
- 用户登录授权时，开放平台会通过 [获取用户信息](/app-integration-dev/wps365/server/certification-authorization/user-authorization/user-info)返回 company_id。

**dept_id**：部门唯一标识。

## 用户相关

**user_id**：用户唯一标识。详情说明可参考[用户身份体系](/app-integration-dev/guide/start/user)。

## 访问凭证

为了提升 API 调用的安全性，WPS 开放平台设计了访问凭证机制。在调用接口前，应用需要先获取所需的访问凭证。了解 WPS 开放平台的权限体系，可以参考[应用权限体系](/app-integration-dev/guide/start/permission)。

访问凭证也称为 access_token，代表应用从租户、用户手中获取的授权。访问凭证包括 2 种：

- 应用访问凭证 access_token。了解 [三方应用获取应用 access_token](/app-integration-dev/wps365/server/certification-authorization/get-token/isvapp-tenant-access-token) 和 [自建应用获取应用 access_token](/app-integration-dev/wps365/server/certification-authorization/get-token/selfapp-tenant-access-token)
- 用户访问凭证 access_token。了解 [获取用户 access_token](/app-integration-dev/wps365/server/certification-authorization/get-token/get-user-access-token)