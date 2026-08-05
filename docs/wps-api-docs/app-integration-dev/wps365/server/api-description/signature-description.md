# KSO-1 签名算法说明

> **注意：**
> **KSO-1 签名仅在「开发者后台-安全设置-接口签名」开启签名时需要**

## Header 说明

| **Header 名称**     | **参数类型** | **是否必填** | **说明**                                                |
| :------------------ | :----------- | :----------- | :------------------------------------------------------ |
| Content-Type        | string       | 是           | 如：`application/json`                                  |
| X-Kso-Date          | string       | 是           | RFC1123 格式的日期，例：`Wed, 23 Jan 2013 06:43:08 GMT` |
| X-Kso-Authorization | string       | 是           | KSO-1 签名值。格式为：`KSO-1 accessKey:signature`       |

> **X-Kso-Authorization 说明：**

1、`KSO-1`：签名算法版本，此处目前固定为 `KSO-1`（**注意：** 后面有一个空格）

2、`accessKey`：应用的 APPID（**注意：** 后面有一个英文冒号 `:`）

3、`signature`：使用 secretKey（应用 APPKEY） 作为密钥、SHA256 作为哈希算法， 通过 HMAC-SHA256 编码内容：
`"KSO-1" + Method + RequestURI + ContentType + KsoDate + sha256(RequestBody)`

- `"KSO-1"`：固定内容，签名版本字符串
- `Method`：请求的方法
- `RequestURI`：请求的 URI，包含 query 参数，例：`/v7/users?page_size=20&page_token=aabb`
- `KsoDate`：RFC1123 格式的日期
- `sha256(RequestBody)`：当请求体不为空时，使用 SHA256 哈希算法计算请求体的值

## 示例

### 示例 1

> 示例的 `RequestBody = ""`，为空

```
// 请求参数
accessKey = "AK123456"
secretKey = "sk098765"
Method = "GET"
RequestURI = "/v7/test?key=value"
ContentType = "application/json"
KsoDate = "Mon, 02 Jan 2006 15:04:05 GMT"
RequestBody = ""

// 计算结果
sha256(RequestBody) = ""
Content-Type = "application/json"
X-Kso-Date = "Mon, 02 Jan 2006 15:04:05 GMT"
X-Kso-Authorization = "KSO-1 AK123456:ce8df66877175e5198c8ea1362ffddf82e4941c6f25a4ca205a1ad09d0faaf03"
```

### 示例 2

> 示例的 `RequestBody = {"key": "value"}`，JSON 数据

```
// 请求参数
accessKey = "AK123456"
secretKey = "sk098765"
Method = "POST"
RequestURI = "/v7/test/body"
ContentType = "application/json"
KsoDate = "Mon, 02 Jan 2006 15:04:05 GMT"
RequestBody = `{"key": "value"}`            // 注意 json 格式，会影响到签名计算

// 计算结果
sha256(RequestBody) = "9724c1e20e6e3e4d7f57ed25f9d4efb006e508590d528c90da597f6a775c13e5"
Content-Type = "application/json"
X-Kso-Date = "Mon, 02 Jan 2006 15:04:05 GMT"
X-Kso-Authorization = "KSO-1 AK123456:c46e6c988130818ecba2484d51ac685948fbbef6814602c7874d6bfc41dc17b3"
```

## Golang 代码示例

### 签名方法示例

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "fmt"
    "net/http"
    "time"
)

type KsoSign struct {
    accessKey string
    secretKey string
}

type Out struct {
    Date          string // X-Kso-Date
    Authorization string // X-Kso-Authorization
}

const (
    ContentType = "Content-Type"
)

func NewKsoSign(accessKey, secretKey string) (*KsoSign, error) {
    if accessKey == "" || secretKey == "" {
        return nil, errors.New("NewKsoSign error: AccessKey/SecretKey can not be empty")
    }
    return &KsoSign{
        accessKey: accessKey,
        secretKey: secretKey,
    }, nil
}

func (k *KsoSign) getKso1Signature(req *http.Request, secretKey, ksoDate, contentType string, requestBody []byte) string {
    sha256Hex := ""
    if len(requestBody) > 0 {
        s := sha256.New()
        s.Write(requestBody)
        sha256Hex = hex.EncodeToString(s.Sum(nil))
    }

    mac := hmac.New(sha256.New, []byte(secretKey))
    mac.Write([]byte("KSO-1" + req.Method + req.URL.RequestURI() + contentType + ksoDate + sha256Hex))
    return hex.EncodeToString(mac.Sum(nil))
}

func (k *KsoSign) KSO1Sign(req *http.Request, requestBody []byte) (*Out, error) {
    contentType := req.Header.Get(ContentType)
    ksoDate := time.Now().UTC().Format(time.RFC1123)

    ksoSignature := k.getKso1Signature(req, k.secretKey, ksoDate, contentType, requestBody)
    authorization := fmt.Sprintf("%s %s:%s", "KSO-1", k.accessKey, ksoSignature)
    return &Out{
        Date:          ksoDate,
        Authorization: authorization,
    }, nil
}
```

### 验签方法示例

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "net/http"
    "strings"
    "time"
)

type KsoSign struct {
}

const (
    KsoAuthHeader = "X-Kso-Authorization"
    KsoDateHeader = "X-Kso-Date"
    Kso1Version   = "KSO-1"
    ContentType   = "Content-Type"
)

func (k *KsoSign) validDate(ksoDate string) (tm time.Time, err error) {
    if tm, err = time.Parse(time.RFC1123, ksoDate); err == nil {
        return
    }
    if tm, err = time.Parse(time.RFC1123Z, ksoDate); err == nil {
        return
    }

    // 或者使用星期是全拼的非标准RFC1123
    RFC1123 := "Monday, 02 Jan 2006 15:04:05 MST"
    if tm, err = time.Parse(RFC1123, ksoDate); err == nil {
        return
    }

    return tm, errors.New("kso1sign check error: invalid kso-date header")
}

func (k *KsoSign) extractSign(authHeader string) (string, string, string, error) {
    spaceParts := strings.SplitN(authHeader, " ", 2)
    if len(spaceParts) != 2 {
        return "", "", "", errors.New("kso1sign check error: invalid authorization header")
    }

    colonParts := strings.SplitN(spaceParts[1], ":", 2)
    if len(colonParts) != 2 {
        return "", "", "", errors.New("kso1sign check error: invalid authorization header")
    }

    return spaceParts[0], colonParts[0], colonParts[1], nil
}

func (k *KsoSign) validSign(req *http.Request, ksoSignature, secretKey, ksoDate, contentType string, requestBody []byte) error {
    sha256Hex := ""
    if len(requestBody) > 0 {
        s := sha256.New()
        s.Write(requestBody)
        sha256Hex = hex.EncodeToString(s.Sum(nil))
    }

    mac := hmac.New(sha256.New, []byte(secretKey))
    mac.Write([]byte("KSO-1" + req.Method + req.URL.RequestURI() + contentType + ksoDate + sha256Hex))
    sign := hex.EncodeToString(mac.Sum(nil))

    if sign == ksoSignature {
        return nil
    }

    return errors.New("kso1sign check error: invalid signature")
}

func (k *KsoSign) Kso1SignCheck(req *http.Request, requestBody []byte, SKGetter func(string) (string, error)) error {
    ksoAuthHeader := req.Header.Get(KsoAuthHeader)
    ksoDate := req.Header.Get(KsoDateHeader)
    contentType := req.Header.Get(ContentType)

    _, err := k.validDate(ksoDate)
    if err != nil {
        return err
    }

    signVersion, accessKey, ksoSignature, err := k.extractSign(ksoAuthHeader)
    if err != nil {
        return err
    }
    if signVersion != Kso1Version {
        return errors.New("kso1sign check error: unknown authorization version")
    }

    // 获取 SK 及校验 AK 合法性
    secretKey, err := SKGetter(accessKey)
    if err != nil {
        return err
    }

    return k.validSign(req, ksoSignature, secretKey, ksoDate, contentType, requestBody)
}
```

## Java 代码示例

### 签名方法示例

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class KsoSign {
    private final String accessKey;
    private final String secretKey;

    public KsoSign(String accessKey, String secretKey) {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
    }

    public static final class Out {
        private final String date;  // X-Kso-Date
        private final String authorization;  // X-Kso-Authorization

        public Out(String date, String authorization) {
            this.date = date;
            this.authorization = authorization;
        }

        public String getDate() {
            return date;
        }

        public String getAuthorization() {
            return authorization;
        }
    }

    public Out kso1Sign(String method, String uri, String contentType, String ksoDate, byte[] requestBody) throws NoSuchAlgorithmException, InvalidKeyException {
        String ksoSignature = getKso1Signature(method, uri, contentType, ksoDate, requestBody);
        String authorization = String.format("KSO-1 %s:%s", accessKey, ksoSignature);
        return new Out(ksoDate, authorization);
    }

    private String getKso1Signature(String method, String uri, String contentType, String ksoDate, byte[] requestBody) throws NoSuchAlgorithmException, InvalidKeyException {
        String sha256Hex = "";
        if (requestBody != null && requestBody.length > 0) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(requestBody);
            sha256Hex = bytesToHex(hash);
        }

        System.out.println("sha256: " + sha256Hex);

        String dataToSign = "KSO-1" + method + uri + contentType + ksoDate + sha256Hex;
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] macBytes = mac.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));
        return bytesToHex(macBytes);
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}

//

public class Main {
    public static void main(String[] args) throws Exception {
        final String accessKey = "AK123456";
        final String secretKey = "sk098765";
        final String method = "POST";
        final String uri = "/v7/test/body";
        final String contentType = "application/json";
        final String contentDate = "Mon, 02 Jan 2006 15:04:05 GMT";
        final byte[] requestBody = "{\"key\": \"value\"}".getBytes(StandardCharsets.UTF_8);

        KsoSign kso = new KsoSign(accessKey, secretKey);
        KsoSign.Out out = kso.kso1Sign(method, uri, contentType, contentDate, requestBody);
        System.out.println(out.getDate());
        System.out.println(out.getAuthorization());
    }
}
```

## Python 代码示例

### 签名方法示例

```python
import hashlib
import hmac
import http

ACCESS_KEY = 'AK123456'
SECRET_KEY = 'sk098765'


def _get_kso1_signature(method, uri, content_type, kso_date, request_body):
    sha256_hex = ''
    if request_body is not None and len(request_body) > 0:
        sha256_obj = hashlib.sha256()
        sha256_obj.update(request_body.encode())
        sha256_hex = sha256_obj.hexdigest()

    mac = hmac.new(bytes(SECRET_KEY, 'utf-8'),
                   bytes('KSO-1' + method + uri + content_type + kso_date + sha256_hex, 'utf-8'),
                   hashlib.sha256)
    return mac.hexdigest()


def kso1_sign(method, uri, content_type, kso_date, request_body):
    kso_signature = _get_kso1_signature(method, uri, content_type, kso_date, request_body)
    authorization = 'KSO-1 {}:{}'.format(ACCESS_KEY, kso_signature)
    return {
        'X-Kso-Date': kso_date,
        'X-Kso-Authorization': authorization
    }


if __name__ == '__main__':
    def test():
        method = http.HTTPMethod.POST
        uri = '/v7/test/body'
        content_type = 'application/json'
        kso_date = 'Mon, 02 Jan 2006 15:04:05 GMT'
        request_body = '{"key": "value"}'

        res = kso1_sign(method, uri, content_type, kso_date, request_body)
        print(res)


    test()
```