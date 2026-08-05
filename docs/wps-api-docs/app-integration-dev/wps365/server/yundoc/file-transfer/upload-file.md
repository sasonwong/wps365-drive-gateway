# 上传实体文件

上传文件分为三个步骤：
1、使用[请求文件上传信息](/app-integration-dev/wps365/server/yundoc/file-transfer/get-upload-file)接口，获取上传文件所需信息
📌 **2、通过接口响应体的上传信息，构建 HTTP 请求，上传实体文件到云存储**
3、使用[提交文件上传完成](/app-integration-dev/wps365/server/yundoc/file-transfer/complete-upload-file)接口，提交上传完成信息

## 请求说明

| **请求地址** | [请求文件上传信息](/app-integration-dev/wps365/server/yundoc/file-transfer/get-upload-file)接口返回的地址 url        |
| :----------- | :--------------------------------------------------------------------------------------------------------------------- |
| **请求方法** | **[请求文件上传信息](/app-integration-dev/wps365/server/yundoc/file-transfer/get-upload-file)接口返回的方法 method** |
| **签名方式** | [KSO-1](/app-integration-dev/wps365/server/api-description/signature-description) |
| **权限要求** | 查询和管理文件（应用授权） `kso.file.readwrite`<br/>查询和管理文件（用户授权） `kso.file.readwrite`           |                                                                                                                  |

## 请求头（Header）

更多详细响应体参数信息见：[请求文件上传信息接口的响应体](/app-integration-dev/wps365/server/yundoc/file-transfer/get-upload-file#desc-rich-text)

## 请求体（Body）

上传的文件内容（文件流）。

## 响应体（Response）

各存储返回结果不一致，请根据实际存储寻找下一步需要的参数，`etag` 值一般在 header 中。