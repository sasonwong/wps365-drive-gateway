# 调用流程

![调用流程](https://cloudcdn.qwps.cn/open/_img/375423cb81.png '调用流程')

1、创建应用：开发者需先在开发者后台创建应用，根据需求选择合适的应用类型。[了解应用类型](/app-integration-dev/guide/app-type)

2、申请 API 权限：API 所需权限在接口文档有所标注，开发者可在【开发者后台-权限申请】处申请。

3、获取访问凭证：WPS 开放平台设置了多种访问凭证（也称为 `access_token`），不同的访问凭证代表了不同的资源访问权限。调用 API 时，需要在请求中携带访问凭证，以便获取权限范围内的资源信息。[了解访问凭证](/app-integration-dev/wps365/server/certification-authorization/summary)

4、配置应用数据权限：当应用申请了部分 API 的权限（例如：通讯录）后，还需要配置相应的数据权限并提交审核。待审核通过后权限生效，才可以成功调用 API 获取数据，否则调用 API 时会返回权限错误。（第三方企业应用无需开发者申请，由租户企业在安装应用时设置）

5、设置 IP 白名单（可选）：为了提升应用的安全性，可以为应用设置 IP 白名单。仅当源 IP 在白名单内时，WPS 开放平台才会响应，否则请求将被拒绝。

6、了解常用术语概念定义将有助于你正确调用接口。[了解通用参数](/app-integration-dev/wps365/server/api-description/noun-description)

7、了解平台通用错误码将有助于定位调用问题。[了解通用错误码](/app-integration-dev/wps365/server/api-description/errorcode)