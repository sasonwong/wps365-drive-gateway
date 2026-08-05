# 云文档文件删除协作者

# 云文档删除协作者事件

## 元信息
```yaml
---
name: kso.file.permission_deleted
description: "当订阅范围内的云文档文件的协作者被移除时触发。"
metadata:
  business_domain: "云文档"
  updated-on: "2026-05-25"
  tags: "drive,file,permission,delete"
  decrypt-type: "AES-CBC"
  scopes: "kso.file.read,kso.file_permission.readwrite"
---
```

## 事件描述
当应用订阅该事件后，如果订阅范围（文件/盘/企业）内的云文档文件的协作者被移除，则会触发该事件。

## 事件信息说明

| 属性 | 说明 |
| --- | --- |
| 事件主题 | `kso.file.permission` |
| 事件行为 | `deleted` |
| 业务域 | 云文档 |
| 权限要求 | 查询文件(应用授权) `kso.file.read`
查询文件(用户授权) `kso.file.read`
查询和管理文件权限(应用授权) `kso.file_permission.readwrite`
查询和管理文件权限(用户授权) `kso.file_permission.readwrite` |
| 解密方式 | 详见 [解密算法](https://365.kdocs.cn/3rd/open/documents/app-integration-dev/wps365/server/event-subscription/security-verification) |
| 重试策略 | 应用收到 HTTP POST 请求后，需要在 3 秒内以 HTTP 200 状态码响应该请求。否则 WPS 开放平台认为本次推送失败，并以 1 秒、2 秒的间隔重新推送事件，最多重试 2 次，如果 2 次失败后仍未成功，则停止推送该事件，但不影响其他事件的推送 |

## 事件体（解密前）
> 全平台统一，所有解密前事件体有且仅有以下参数信息。

| 参数名称 | 参数类型 | 是否必填 | 可选值
枚举需提供 | 限制 | 示例 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| topic | string | 是 | `kso.file.permission` | - | `"kso.file.permission"` | 事件主题 |
| operation | string | 是 | `delete` | - | `"delete"` | 变更行为
delete：删除协作者 |
| time | integer | 是 | - | - | `1704074400` | 事件发生时间，秒级时间戳 |
| nonce | string | 是 | - | - | `"71***********7"` | IV 向量（解密时使用） |
| signature | string | 是 | - | - | `"w6**********6Q"` | 签名 |
| encrypted_data | string | 是 | - | - | `"B7**********iA=="` | 业务事件体加密字段 |

## 事件体示例（解密前）
```json
{
  "topic": "kso.file.permission",
  "operation": "delete",
  "time": 1704074400,
  "nonce": "71***********7",
  "signature": "w6**********6Q",
  "encrypted_data": "B7**********iA=="
}
```

## 业务事件体（encrypted_data解密后）
> 云文档删除协作者事件的业务数据

| 参数名称 | 参数类型 | 是否必填 | 可选值
枚举需提供 | 限制 | 示例 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| drive_id | string | 是 | - | - | `"D*****8"` | 盘 ID |
| file_id | string | 是 | - | - | `"F*****3"` | 文件 ID |
| subjects | array[object] | 是 | - | - | - | 被移除的协作者列表 |
| ∟ subject_type | string | 是 | - | - | `"user"` | 协作者类型 |
| ∟ subject_id | string | 是 | - | - | `"S*****2"` | 协作者 ID |
| ∟ subject_ext_id | string | 否 | - | - | `"E*****3"` | 协作者扩展 ID |
| operator | object | 是 | - | - | - | 操作者信息 |
| ∟ id | string | 是 | - | - | `"U*****1"` | 操作者用户 ID |
| ∟ name | string | 是 | - | - | `"张三"` | 操作者用户名 |
| ∟ avatar | string | 否 | - | - | `"https://example.com/avatar.png"` | 操作者头像 URL |
| ∟ company_id | string | 是 | - | - | `"A*****6"` | 操作者所属企业 ID |
| ∟ type | string | 是 | `user` | - | `"user"` | 操作者类型 |

## 业务事件体示例（解密后）
```json
{
  "drive_id": "D*****8",
  "file_id": "F*****3",
  "subjects": [
    {
      "subject_type": "user",
      "subject_id": "S*****2",
      "subject_ext_id": "E*****3"
    }
  ],
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

    print(f"删除协作者事件: file_id={data['file_id' "
          f"operator={data['operator']['name' subjects={data['subjects'")

    return jsonify({"code": 0})

if __name__ == "__main__":
    app.run()
```
