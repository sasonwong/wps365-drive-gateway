# 文件秒传

# 文件秒传

文件秒传(公网目前只支持1M及以上文件,且不保证上传后的文件秒传一定能命中)

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{parent_id}/rapid_upload          |
| **HTTP 方法
** | `POST`    |
| **接口描述
**  | 文件秒传(公网目前只支持1M及以上文件,且不保证上传后的文件秒传一定能命中) |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询和管理文件(用户授权) `kso.file.readwrite`

 |

## 请求头 (Headers)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| X-Kso-Id-Type
 | `string` | 否 | 类型
  * **internal** - 内部
  * **external** - 外部
 | `internal`, `external` 

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 | 驱动盘id | - 
| parent_id
 | `string` | 是 | 文件夹id（根目录时为0） | - 

## 请求体(Body)
**请求体格式:** `application/json`
公有云适用，文件展示大小，不得小于文件本体的真实大小，用于计算文件空间占用、文件信息展示、文件大小排序, 该字段为空默认使用文件真实大小
file_id: 公有云适用，更新上传时指定文件id(不推荐编辑更新场景使用秒传)
\n,hashes: 文件哈希信息，用于判断是否支持秒传，目前仅支持sha256
\n,type: 哈希类型
\nname: 文件名(更新文件时忽略)
\n,on_name_conflict: 新建时文件名冲突行为处理方式(公网目前只支持rename和overwrite), 默认不传为rename
\n,on_parent_path_conflict: 私有云适用，新建时文件parent_path的冲突行为处理方式，目前支持重命名和合并两种方式，默认是合并。示例：上传文件a.txt时希望同时创建a.txt的父路径 1/2/3, 但如果此时云上对应位置已经存在了 1/2/3, 那么若选择重命名，则会上传为 1(1)/2/3/a.txt，若选择合并则上传为 1/2/3/a.txt
\n,parent_path: 该参数用于指定相对于当前文件目录的相对路径。数组中的每个元素代表一个路径名，而非路径ID。若指定的路径不存在，系统将自动创建该路径
\n,proof: 公有云适用，文件秒传请求proof参数,公网必传
\n,"children":[code: proof_code 根据原文件和proof_data_range(从[获取文件秒传策略]接口获取)计算而来。计算方式:取出源文件数据范围(proof_data_range)内的部分，计算出这部分的sha256(16进制小写)
\n,token: 验证策略协商的token,从[获取文件秒传策略]接口获取
\nsize: 文件本体的真实大小
\n,]' />

## 请求体示例
```json
{
  "display_size": 0,
  "file_id": "string",
  "hashes": [
    {
      "sum": "string",
      "type": "sha256"
    }
  ],
  "name": "string",
  "on_name_conflict": "fail",
  "on_parent_path_conflict": "rename",
  "parent_path": [
    "string"
  ],
  "proof": {
    "code": "string",
    "token": "string"
  },
  "size": 0
}
```

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
文件创建者信息; 在降级场景下, created_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 文件创建时间，时间戳，单位为秒
\n,drive: 文件驱动盘具体信息，默认不返回，入参中有with_drive参数时可控制
\n,allotee_type: 盘归属身份类型
\n,bucket: 私有云适用，私网应用文档专属；盘存储的bucket位置
\n,company_id: 企业id
\n,created_by: 创建者; 在降级场景下, created_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nctime: 创建时间，时间戳，单位为秒
\n,description: 盘描述
\n,ext_attrs: 盘扩展属性
\n,value: 属性值
\nid: 驱动盘id
\n,mtime: 修改时间，时间戳，单位为秒
\n,name: 驱动盘名称
\n,quota: 盘容量
\n,remaining: 剩余的总空间，以字节为单位。只读。
\n,total: 允许的总存储空间，以字节为单位。只读。
\n,used: 已使用的总空间，以字节为单位。只读。
\nsource: 盘来源
\n,status: 盘状态
\ndrive_id: 驱动盘id
\n,ext_attrs: 文件扩展属性
\n,value: 属性值
\nhash: 私有云适用，文件散列值。公网不返回此参数
\n,type: 哈希类型
\nid: 文件id
\n,link_id: 分享id
\n,link_url: 分享链接url
\n,modified_by: 文件修改者信息; 在降级场景下, modified_by的type字段会返回unknown. 业务方如果使用到type字段, 需要在type为unknown时作降级处理.
\n,company_id: 身份所归属的公司
\n,id: 身份ID
\n,name: 用户或应用的名称
\n,type: 身份类型
\nmtime: 文件修改时间，时间戳，单位为秒
\n,name: 文件名
\n,parent_id: 父目录id
\n,permission: 文件权限，默认不返回，入参中有with_permission参数时可控制
\n,copy: 复制
\n,copy_content: 内容复制
\n,delete: 文件删除
\n,download: 下载
\n,history: 公有云适用，历史版本，仅公网支持
\n,list: 列表
\n,move: 文件移动
\n,new_empty: 新建
\n,perm_ctl: 权限管理
\n,preview: 预览
\n,print: 打印
\n,rename: 文件重命名
\n,saveas: 公有云适用，另存为，仅公网支持
\n,secret: 公有云适用，安全文档，仅公网支持
\n,share: 分享
\n,update: 编辑/更新
\n,upload: 上传：手动上传新版本
\nshared: 公有云适用，是否开启分享，当link.status = 'open’时，shared为true，其他结果为false。若调用方想提前知道文档是否分享但又不想额外调用分享信息，可使用此字段
\n,size: 文件大小
\n,type: 文件类型
\n,version: 文件版本
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应体示例
```json
{
  "data": {
    "created_by": {
      "avatar": "string",
      "company_id": "string",
      "id": "string",
      "name": "string",
      "type": "user"
    },
    "ctime": 0,
    "drive": {
      "allotee_id": "string",
      "allotee_type": "user",
      "bucket": "string",
      "company_id": "string",
      "created_by": {
        "avatar": "string",
        "company_id": "string",
        "id": "string",
        "name": "string",
        "type": "user"
      },
      "ctime": 0,
      "description": "string",
      "ext_attrs": [
        {
          "name": "string",
          "value": "string"
        }
      ],
      "id": "string",
      "mtime": 0,
      "name": "string",
      "quota": {
        "deleted": 0,
        "remaining": 0,
        "total": 0,
        "used": 0
      },
      "source": "string",
      "status": "inuse"
    },
    "drive_id": "string",
    "ext_attrs": [
      {
        "name": "string",
        "value": "string"
      }
    ],
    "hash": {
      "sum": "string",
      "type": "sha256"
    },
    "id": "string",
    "link_id": "string",
    "link_url": "string",
    "modified_by": {
      "avatar": "string",
      "company_id": "string",
      "id": "string",
      "name": "string",
      "type": "user"
    },
    "mtime": 0,
    "name": "string",
    "parent_id": "string",
    "permission": {
      "comment": true,
      "copy": true,
      "copy_content": true,
      "delete": true,
      "download": true,
      "history": true,
      "list": true,
      "move": true,
      "new_empty": true,
      "perm_ctl": true,
      "preview": true,
      "print": true,
      "rename": true,
      "saveas": true,
      "secret": true,
      "share": true,
      "update": true,
      "upload": true
    },
    "shared": true,
    "size": 0,
    "type": "folder",
    "version": 0
  },
  "code": 0,
  "msg": "string"
}
```