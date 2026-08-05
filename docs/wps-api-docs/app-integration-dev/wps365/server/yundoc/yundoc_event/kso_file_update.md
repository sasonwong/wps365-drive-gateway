# 云文档文件更新事件

# 云文档文件更新事件

## 元信息
```yaml
---
name: kso.file_updated
description: "当订阅范围内的云文档文件被编辑更新时触发。"
metadata:
  business_domain: "云文档"
  updated-on: "2026-05-25"
  tags: "drive,file,update"
  decrypt-type: "AES-CBC"
  scopes: "kso.file.read"
---
```

## 事件描述
当应用订阅该事件后，如果订阅范围（文件/盘/企业）内的云文档文件被编辑更新（包括上传编辑和 WebOffice 页面编辑），则会触发该事件。

## 事件信息说明

| 属性 | 说明 |
| --- | --- |
| 事件主题 | `kso.file` |
| 事件行为 | `updated` |
| 业务域 | 云文档 |
| 权限要求 | 查询文件(应用授权) `kso.file.read`
查询文件(用户授权) `kso.file.read` |
| 解密方式 | 详见 [解密算法](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/event-subscription/security-verification) |
| 重试策略 | 应用收到 HTTP POST 请求后，需要在 3 秒内以 HTTP 200 状态码响应该请求。否则 WPS 开放平台认为本次推送失败，并以 1 秒、2 秒的间隔重新推送事件，最多重试 2 次，如果 2 次失败后仍未成功，则停止推送该事件，但不影响其他事件的推送 |

## 事件体（解密前）
> 全平台统一，所有解密前事件体有且仅有以下参数信息。

| 参数名称 | 参数类型 | 是否必填 | 可选值
枚举需提供 | 限制 | 示例 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| topic | string | 是 | `kso.file` | - | `"kso.file"` | 事件主题 |
| operation | string | 是 | `update` | - | `"update"` | 变更行为
update：文件更新 |
| time | integer | 是 | - | - | `1704074400` | 事件发生时间，秒级时间戳 |
| nonce | string | 是 | - | - | `"71***********7"` | IV 向量（解密时使用） |
| signature | string | 是 | - | - | `"w6**********6Q"` | 签名 |
| encrypted_data | string | 是 | - | - | `"B7**********iA=="` | 业务事件体加密字段 |

## 事件体示例（解密前）
```json
{
  "topic": "kso.file",
  "operation": "update",
  "time": 1704074400,
  "nonce": "71***********7",
  "signature": "w6**********6Q",
  "encrypted_data": "B7**********iA=="
}
```

## 业务事件体（encrypted_data解密后）
> 云文档文件更新事件的业务数据

| 参数名称 | 参数类型 | 是否必填 | 可选值
枚举需提供 | 限制 | 示例 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| company_id | string | 是 | - | - | `"A*****6"` | 企业 ID |
| drive_id | string | 是 | - | - | `"D*****8"` | 盘 ID |
| drive_source | string | 是 | `yundoc`、`woa` | - | `"yundoc"` | 盘归属
yundoc：云文档创建；woa：协作创建 |
| file_id | string | 是 | - | - | `"F*****3"` | 文件 ID |
| parent_id | string | 是 | - | - | `"P*****1"` | 父文件 ID |
| name | string | 是 | - | - | `"产品需求文档.docx"` | 文件名 |
| type | string | 是 | - | - | `"file"` | 文件类型 |
| size | integer | 是 | - | - | `102400` | 文件大小（字节） |
| ctime | integer | 是 | - | - | `1704060000` | 文件创建时间（秒级时间戳） |
| mtime | integer | 是 | - | - | `1704074400` | 文件更新时间（秒级时间戳） |
| version | integer | 否 | - | - | `5` | 文件版本号 |
| update_source | string | 是 | `yundoc`、`weboffice` | - | `"yundoc"` | 更新来源
yundoc：上传编辑；weboffice：页面编辑 |
| operator | object | 是 | - | - | - | 操作者信息 |
| ∟ id | string | 是 | - | - | `"U*****1"` | 操作者用户 ID |
| ∟ name | string | 是 | - | - | `"张三"` | 操作者用户名 |
| ∟ avatar | string | 否 | - | - | `"https://example.com/avatar.png"` | 操作者头像 URL |
| ∟ company_id | string | 是 | - | - | `"A*****6"` | 操作者所属企业 ID |
| ∟ type | string | 是 | `user` | - | `"user"` | 操作者类型 |

## 业务事件体示例（解密后）
```json
{
  "company_id": "A*****6",
  "drive_id": "D*****8",
  "drive_source": "yundoc",
  "file_id": "F*****3",
  "parent_id": "P*****1",
  "name": "产品需求文档.docx",
  "type": "file",
  "size": 102400,
  "ctime": 1704060000,
  "mtime": 1704074400,
  "version": 5,
  "update_source": "yundoc",
  "operator": {
    "id": "U*****1",
    "name": "张三",
    "avatar": "https://example.com/avatar.png",
    "company_id": "A*****6",
    "type": "user"
  }
}
```

## 接收示例
### Go
```go
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func Encrypt(rawData []byte, cipherKey, nonce string) (string, error) {
	data, err := AESCBCEncrypt(rawData, []byte(cipherKey), []byte(nonce))
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func Decrypt(encryptedData, cipherKey, nonce string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", err
	}
	rawData, err := AESCBCPKCS7Decrypt(data, []byte(cipherKey), []byte(nonce))
	if err != nil {
		return "", err
	}
	return string(rawData), nil
}

func AESCBCEncrypt(rawData, key, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	blockSize := block.BlockSize()
	rawData = PKCS7Padding(rawData, blockSize)
	cipherText := make([]byte, len(rawData))
	iv := nonce[:blockSize]
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(cipherText, rawData)
	return cipherText, nil
}

func AESCBCPKCS7Decrypt(encryptData, key, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	blockSize := block.BlockSize()
	if len(encryptData)  bytes:
    unpadding = data[-1]
    return data[:-unpadding]

def decrypt(encrypted_data: str, cipher_key: str, nonce: str) -> str:
    data = base64.b64decode(encrypted_data)
    key = cipher_key.encode("utf-8")
    iv = nonce.encode("utf-8")[:16]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    raw = cipher.decrypt(data)
    return pkcs7_unpadding(raw).decode("utf-8")

def hmac_sha256(message: str, secret: str) -> str:
    h = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256)
    return base64.urlsafe_b64encode(h.digest()).rstrip(b"=").decode("utf-8")

def md5(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()

@app.route("/open/receive", methods=["POST"])
def receive_event():
    event = request.get_json()

    # 验证签名
    content = f"{ACCESS_KEY}:{event['topic':{event['nonce':{event['time':{event['encrypted_data'"
    signature = hmac_sha256(content, SECRET_KEY)
    if signature != event["signature"]:
        return jsonify({"error": "signature check failed"}), 400

    # 解密数据
    cipher_key = md5(SECRET_KEY)
    decrypted_data = decrypt(event["encrypted_data"], cipher_key, event["nonce"])
    data = json.loads(decrypted_data)

    print(f"文件更新事件: file_id={data['file_id' name={data['name' "
          f"operator={data['operator']['name' update_source={data['update_source'")

    return jsonify({"code": 0})

if __name__ == "__main__":
    app.run()
```
