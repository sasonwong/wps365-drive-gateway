# 获取收藏列表

# 获取收藏列表

## API 说明

获取收藏列表。

## 元信息

```yaml
---
name: open_v7_list_star_items
description: "获取收藏列表"
metadata:
  business_domain: "云文档"
  updated-on: "2026-05-28"
  tags: "文件"
  operation-id: "open_v7_list_star_items"
  sign-type: "[KSO-1](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description)"
  auth-type: "app_and_user_token"
  scopes: "delegated:kso.file.readwrite, delegated:kso.file.read, app:kso.file.readwrite, app:kso.file.read"
  rate-limit: "无"
---
```

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drive_star/items          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 获取收藏列表 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询文件(应用授权) `kso.file.read`

查询和管理文件(用户授权) `kso.file.readwrite`

查询文件(用户授权) `kso.file.read`

 |

## 请求头（Headers）

| **Header 名称** | **参数类型** | **是否必填** | **可选值** | **限制** | **示例** | **描述** |
| --- | --- | --- | --- | --- | --- | --- |
| X-Kso-Id-Type | string | 否 | internal：内部
external：外部
 | - | `internal` | 开放 ID 类型，默认 internal，目前仅用户 ID 和部门 ID 存在转换 |
| X-Kso-Date | string | 是 | - | 必须符合 RFC1123 规范 | `Thu, 28 May 2026 06:00:00 GMT` | 请求时间，用于防重放攻击等 |
| X-Kso-Authorization | string | 是 | - | - | `KSO-1 AK123456:ce8df66877175e5198c8ea1362ffddf82e4941c6f25a4ca205a1ad09d0faaf03` | KSO-1 签名值，详见 [签名方法](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| Authorization | string | 是 | - | 必须以 Bearer 开头 | `Bearer {access_token}` | 授权凭证，格式为：`Bearer {access_token}`，获取方式详见 [认证授权概述](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/certification-authorization/summary) |

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| with_permission
 | `boolean` | 否 | 是否返回文件操作权限 | - 
| page_size
 | `integer` | 是 | 分页大小,公网限制最大为200 | - 
| page_token
 | `string` | 否 | 翻页token | - 
| include_exts
 | `string` | 否 | 过滤文件后缀。传入多个以英文逗号分隔，不需要空格，不传或者空字符串表示不过滤 | - 

## 请求示例

### cURL

```bash
curl -X GET "https://openapi.wps.cn/v7/drive_star/items?page_size=20&with_permission=true" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "X-Kso-Id-Type: internal" \
  -H "X-Kso-Date: Thu, 28 May 2026 06:00:00 GMT" \
  -H "X-Kso-Authorization: {{kso1_signature}}"
```

### Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type StarItem struct {
	ObjectType string      `json:"object_type"`
	Ctime      int64       `json:"ctime"`
	FileSrc    *FileSource `json:"file_src,omitempty"`
	File       *File       `json:"file,omitempty"`
	Drive      *Drive      `json:"drive,omitempty"`
}

type FileSource struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Path string `json:"path,omitempty"`
}

type Identity struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Name      string `json:"name,omitempty"`
	Avatar    string `json:"avatar,omitempty"`
	CompanyID string `json:"company_id,omitempty"`
}

type ExtendedAttribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type PermissionBits struct {
	List        *bool `json:"list,omitempty"`
	Preview     *bool `json:"preview,omitempty"`
	CopyContent *bool `json:"copy_content,omitempty"`
	Print       *bool `json:"print,omitempty"`
	Download    *bool `json:"download,omitempty"`
	Copy        *bool `json:"copy,omitempty"`
	Comment     *bool `json:"comment,omitempty"`
	Update      *bool `json:"update,omitempty"`
	NewEmpty    *bool `json:"new_empty,omitempty"`
	Upload      *bool `json:"upload,omitempty"`
	Rename      *bool `json:"rename,omitempty"`
	Share       *bool `json:"share,omitempty"`
	Move        *bool `json:"move,omitempty"`
	Delete      *bool `json:"delete,omitempty"`
	PermCtl     *bool `json:"perm_ctl,omitempty"`
	History     *bool `json:"history,omitempty"`
	Secret      *bool `json:"secret,omitempty"`
	Saveas      *bool `json:"saveas,omitempty"`
}

type DriveQuota struct {
	Total     int64 `json:"total"`
	Used      int64 `json:"used"`
	Remaining int64 `json:"remaining"`
	Deleted   int64 `json:"deleted"`
}

type Drive struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	AlloteeType string              `json:"allotee_type"`
	AlloteeID   string              `json:"allotee_id"`
	CompanyID   string              `json:"company_id"`
	CreatedBy   Identity            `json:"created_by"`
	Ctime       int64               `json:"ctime"`
	Mtime       int64               `json:"mtime"`
	Description string              `json:"description"`
	Quota       DriveQuota          `json:"quota"`
	Status      string              `json:"status"`
	ExtAttrs    []ExtendedAttribute `json:"ext_attrs,omitempty"`
	Source      string              `json:"source"`
}

type File struct {
	ID         string              `json:"id"`
	DriveID    string              `json:"drive_id"`
	ParentID   string              `json:"parent_id"`
	CreatedBy  Identity            `json:"created_by"`
	ModifiedBy Identity            `json:"modified_by"`
	Size       int64               `json:"size"`
	Version    int                 `json:"version"`
	Type       string              `json:"type"`
	Name       string              `json:"name"`
	Ctime      int64               `json:"ctime"`
	Mtime      int64               `json:"mtime"`
	LinkURL    string              `json:"link_url"`
	LinkID     string              `json:"link_id"`
	ExtAttrs   []ExtendedAttribute `json:"ext_attrs,omitempty"`
	Permission *PermissionBits     `json:"permission,omitempty"`
	Drive      *Drive              `json:"drive,omitempty"`
	Shared     bool                `json:"shared"`
}

type ListStarItemsResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Items         []StarItem `json:"items"`
		NextPageToken string     `json:"next_page_token"`
	} `json:"data"`
}

func listStarItems(accessToken, ksoAuth string) error {
	params := url.Values{}
	params.Set("page_size", "20")
	params.Set("with_permission", "true")

	reqURL := "https://openapi.wps.cn/v7/drive_star/items?" + params.Encode()
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Kso-Id-Type", "internal")
	req.Header.Set("X-Kso-Date", "Thu, 28 May 2026 06:00:00 GMT")
	req.Header.Set("X-Kso-Authorization", ksoAuth)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	var result ListStarItemsResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("unmarshal response: %w", err)
	}

	fmt.Printf("Code: %d, Items: %d, NextPageToken: %s\n", result.Code, len(result.Data.Items), result.Data.NextPageToken)
	return nil
}

func main() {
	if err := listStarItems("{access_token}", "{kso1_signature}"); err != nil {
		fmt.Println("Error:", err)
	}
}
```

## 响应体（Response）
**HTTP状态码:** `200`

**响应体格式:** `application/json`
数据集合
drive: 文件存储的介质
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
\nfile: -,company_id: 身份所归属的公司
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
\nfile_src: 文件来源
\n,path: 文件路径
\n,type: 来源类型
\nobject_type: 收藏对象类型
\nnext_page_token: 下一页token
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' >

## 响应示例
```json
{
  "data": {
    "items": [
      {
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
        "file": {
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
        "file_src": {
          "name": "string",
          "path": "string",
          "type": "link"
        },
        "object_type": "file"
      }
    ],
    "next_page_token": "string"
  },
  "code": 0,
  "msg": "string"
}
```

## 错误码

| **HTTP状态码** | **错误码** | **错误描述** | **排查建议** |
| --- | --- | --- | --- |
| 400 | 400000004 | 请求参数不支持 | 请检查请求参数是否正确 |