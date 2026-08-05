# 请求文件上传信息

# 请求文件上传信息

这是三步上传的第1步，三步上传大致流程(必须成功才算上传完成):

           1.请求文件上传信息获取上传地址等信息 

           2.根据第1步返回的上传信息去上传实体文件到云存储 

           3.调用[提交文件上传完成]接口

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{parent_id}/request_upload          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 这是三步上传的第1步，三步上传大致流程(必须成功才算上传完成):

           1.请求文件上传信息获取上传地址等信息 

           2.根据第1步返回的上传信息去上传实体文件到云存储 

           3.调用[提交文件上传完成]接口 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询和管理文件(用户授权) `kso.file.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 
| parent_id
 | `string` | 是 |  | - 

## 请求体(Body)
**请求体格式:** `application/json`
更新上传时指定文件id
hashes: 文件哈希信息，用于完整性校验，公网必传,至少md5和sha256中的一种，公网不支持s2s
\n,type: 哈希类型
\ninternal: 是否返回内网上传地址，默认为false。(内部服务支持内网传输请优先走内网)
\n,method: 私有云适用，文件上传方法，私有化默认为WPS3_POST，公网无此参数，所有返回上传方法均为PUT
\n,name: 文件名(更新文件时忽略),需要携带文件名后缀，例如 文件1.doc
\n,on_name_conflict: 新建时文件名冲突行为处理方式(公网目前只支持rename和overwrite), 默认不传为rename
\n,on_parent_path_conflict: 私有云适用，新建时文件parent_path的冲突行为处理方式，目前支持重命名和合并两种方式，默认是合并。示例：上传文件a.txt时希望同时创建a.txt的父路径 1/2/3, 但如果此时云上对应位置已经存在了 1/2/3, 那么若选择重命名，则会上传为 1(1)/2/3/a.txt，若选择合并则上传为 1/2/3/a.txt
\n,parent_path: 该参数用于指定相对于当前文件目录的相对路径。数组中的每个元素代表一个路径名，而非路径ID。若指定的路径不存在，系统将自动创建该路径
\n,size: 文件大小
\n,storage_base_domain: 公有云适用，wps.cn/kdocs.cn/wps365.com(国际化)/wps.com(国际化),签发的存储网关地址会根据base_domain优先匹配 *.wps.cn/*.kdocs.cn/*.wps365.com/*.wps.com。
\n为空会根据请求的host优先选择关联的base_domain.(注意目前有些旧文件未被存储网关托管,针对这些文件的下载此参数可能失效)
\n,upload_scene: 文件上传场景,默认是’normal_upload’
\n,]' />

## 请求体示例
```json
{
  "file_id": "string",
  "hashes": [
    {
      "sum": "string",
      "type": "sha256"
    }
  ],
  "internal": true,
  "method": "PUT",
  "name": "string",
  "on_name_conflict": "fail",
  "on_parent_path_conflict": "rename",
  "parent_path": [
    "string"
  ],
  "size": 0,
  "storage_base_domain": "string",
  "upload_scene": "normal_upload"
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
文件请求上传响应体
store_request: 第二步上传请求信息
\n,value: 值
\nheaders: 私有云适用，存储上传时需要携带的头部信息，公网无此参数
\n,value: 值
\nmethod: 存储上传方法，公网仅会返回PUT
\n,url: 存储上传使用的地址。公网环境下，当返回地址一级域名为金山办公管理域名（wps.cn或kdocs.cn）时，调用上传地址时需要带与调用此申请地址接口相同的登录凭据（wpssid或ksosid）和设备信息凭据（wpsua或kso设备信息采集方案，若调用申请地址接口时未提供则无需提供），存储网关会进行校验。
\nstore_response_keys: 私有云适用，第二步上传响应中的回传字段，调用者需要根据这些字段从第二步响应中取出回传信息，并在第三步时进行回传，公网无此字段
\n,header_keys: 响应头中的回传字段
\nupload_id: 上传标识
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应体示例
```json
{
  "data": {
    "store_request": {
      "body_params": [
        {
          "name": "string",
          "value": "string"
        }
      ],
      "headers": [
        {
          "name": "string",
          "value": "string"
        }
      ],
      "method": "string",
      "url": "string"
    },
    "store_response_keys": {
      "body_keys": [
        "string"
      ],
      "header_keys": [
        "string"
      ]
    },
    "upload_id": "string"
  },
  "code": 0,
  "msg": "string"
}
```