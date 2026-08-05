# 分块上传任务初始化

# 分块上传任务初始化

**标签**：`文件-上传下载` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{parent_id}/create_multipart_upload_task          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 分块上传步骤:

            1.分块上传任务初始化 

            2.签发分块上传的块上传地址(私网需要,公网不需要,公网第1步已经获取到了上传地址.具体参考[分块上传任务初始化]响应体描述)

            3.上传分块实体 

            4.调用[提交文件上传完成]接口，注意和整块上传的提交完成不是同一个接口"
           |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

应用身份管理文档(应用授权) `kso.appfile.readwrite`

查询和管理文件(用户授权) `kso.file.readwrite`

 |

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 | 驱动盘id | - 
| parent_id
 | `string` | 是 | 文件夹id（根目录时为0） | - 

## 请求体(Body)
**请求体格式:** `application/json`
应用身份可以通过delegate_user_id参数委托用户上传文件实体。 文件操作权限依然根据操作者的进行判断，但是上传实体时需要校验delegate_user_id的身份凭证。提交文件上传后, 文件的创建者依然是操作者。该参数仅允许操作者是应用身份时使用。
display_size: 文件展示大小，不得小于文件本体的真实大小，用于计算文件空间占用、文件信息展示、文件大小排序, 该字段为空默认使用文件真实大小
\n,file_id: 更新上传时指定文件id
\n,hashes: 文件哈希信息，用于设置对象key和完整性校验；公网sha256必传，其他散列值选传，公网不支持s2s
\n,type: 哈希类型
\ninternal: 是否返回内网上传地址，默认为false。(内部服务支持内网传输请优先走内网)
\n,mode: 上传模式，分为顺序模式和并发乱序模式。顺序模式要求所有块上传按顺序进行，并发或乱序将导致报错；并发乱序模式允许乱序和并发上传，但上传请求头必须带块的parallel_hash信息。公网必传但目前仅支持sequential，私有化无此参数。
\n,name: 文件名(更新文件时忽略)
\n,on_name_conflict: 新建时文件名冲突行为处理方式(公网目前只支持rename和overwrite), 默认不传为rename
\n,parent_path: 该参数用于指定相对于当前文件目录的相对路径。数组中的每个元素代表一个路径名，而非路径ID。若指定的路径不存在，系统将自动创建该路径
\n,size: 文件本体的真实大小
\n,storage_base_domain: wps.cn/kdocs.cn/wps365.com(国际化),签发的存储网关地址会根据base_domain优先匹配 *.wps.cn/*.kdocs.cn/*.wps365.com。
\n为空会根据请求的host优先选择关联的base_domain.(注意目前有些旧文件未被存储网关托管,针对这些文件的下载此参数可能失效)
\n,upload_scene: 文件上传场景,默认是’normal_upload’
\n,]' />

## 请求体示例
```json
{
  "delegate_user_id": "string",
  "display_size": 0,
  "file_id": "string",
  "hashes": [
    {
      "sum": "string",
      "type": "sha256"
    }
  ],
  "internal": true,
  "mode": "sequential",
  "name": "string",
  "on_name_conflict": "fail",
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
初始化分块上传任务响应体
part_size: 分块大小，客户端上传时，除最后一块之外，其他块大小必须严格与此值一致，否则报错
\n,upload_addr: 上传块地址，公网环境后续直接向此地址完成所有块的上传，私有化环境无此参数。当返回地址一级域名为金山办公管理域名（wps.cn或kdocs.cn）时，调用上传地址时需要带与调用此初始化任务接口相同的登录凭据（wpssid或ksosid）和设备信息凭据（wpsua或kso设备信息采集方案，若调用初始化任务接口时未提供则无需提供），存储网关会进行校验。
\n,upload_id: 上传标识
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "part_count": 0,
    "part_size": 0,
    "upload_addr": "string",
    "upload_id": "string"
  },
  "code": 0,
  "msg": "string"
}
```