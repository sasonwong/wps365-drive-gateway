# <span id="des1">WPS3签名算法说明</span>
## Header说明
Header名称	|  是否必须  |  说明
---|:---:|---
Date | 是 | RFC1123格式的日期,例如：`Mon, 02 Jan 2006 15:04:05 +0800`
Content-Md5 | 是 |  当HTTP请求的body有数据时，计算Body的MD5值，否则计算空字符串的MD5值。再将MD5值转为16进制表达式的字符串,即：</br>`Format("%x", md5Byte)`
X-Auth | 是 | "WPS-3:" + AppId + ":" + sign(AppKey + Content-Md5 + URL + Content-Type + Date)

* WPS-3： 接口版本，固定为WPS-3
* URL：不带域名，包含uri和query参数，例如"`/api_url?app_id=aaaa`"
* sign： `sha1(AppKey + Content-Md5 + URL + Content-Type + Date).HexString()`，
  将标准sha1算法算出来的结果，转为16进制表达式的字符串，即：`Format("%x", sha1Byte)`。结果为一个40个小写字符组成的字符串。

## 示例  
### Date示例
```
Monday, 02 Jan 2006 15:04:05 MST
Mon, _2 Jan 2006 15:04:05 MST
Mon, 02 Jan 2006 15:04:05 -0700
```
### Content-Md5示例
```
空字符串计算结果：
Content-Md5: d41d8cd98f00b204e9800998ecf8427e
```
### 完整示例
```java
String AppId = "AK123"
String AppKey = "sk456"
String URL = "/api/v1/dosomething?name=xiaoming&age=18"
String ContentType = "application/json"
String Date = "Wed, 03 Nov 2021 02:55:55 GMT"
String RequestBody = ""

sign(AppKey + Content-Md5 + URL + Content-Type + Date)
结果为：695229194add4899ffde601d691a1f2d398e7fab

结果Header：
Date: Wed, 03 Nov 2021 02:55:55 GMT
Content-Md5: d41d8cd98f00b204e9800998ecf8427e
Content-Type: application/json
X-Auth: WPS-3:AK123:695229194add4899ffde601d691a1f2d398e7fab
```

## <span id="des2">Go代码示例</span>
``` go
import (
	"crypto/md5"
	"crypto/sha1"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	AppID  = ""
	AppKey = ""
)

func WPS3Sign(request *http.Request, data []byte) {
	contentType := "application/json"

	m := md5.New()
	m.Write(data)
	contentMd5 := fmt.Sprintf("%x", m.Sum(nil))
	date := time.Now().UTC().Format(http.TimeFormat)

	s := sha1.New()
	io.WriteString(s, AppKey)
	io.WriteString(s, contentMd5)
	io.WriteString(s, request.URL.RequestURI())
	io.WriteString(s, contentType)
	io.WriteString(s, date)
	sign := fmt.Sprintf("%x", s.Sum(nil))
	sign = fmt.Sprintf("WPS-3:%s:%s", AppID, sign)

	request.Header.Set("Content-Md5", contentMd5)
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("Date", date)
	request.Header.Set("X-Auth", sign)
}
```

## <span id="des3">Python代码示例</span>

```python
import json
import requests
import hashlib
import time

# 应用信息
app_id = ""
app_key = ""
openapi_host = "https://openapi.wps.cn"


def _sig(content_md5, url, date):
    sha1 = hashlib.sha1(app_key.encode('utf-8'))
    sha1.update(content_md5.encode('utf-8'))
    sha1.update(url.encode('utf-8'))
    sha1.update("application/json".encode('utf-8'))
    sha1.update(date.encode('utf-8'))

    return "WPS-3:%s:%s" % (app_id, sha1.hexdigest())


def request(method, host, uri, body=None, cookie=None, headers=None):
    requests.packages.urllib3.disable_warnings()

    if method == "PUT" or method == "POST" or method == "DELETE":
        body = json.dumps(body)

    if method == "PUT" or method == "POST" or method == "DELETE":
        content_md5 = hashlib.md5(body.encode('utf-8')).hexdigest()
    else:
        content_md5 = hashlib.md5("".encode('utf-8')).hexdigest()

    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    # print date
    header = {"Content-type": "application/json"}
    header['X-Auth'] = _sig(content_md5, uri, date)
    header['Date'] = date
    header['Content-Md5'] = content_md5

    if headers != None:
        header = {}
        for key, value in headers.items():
            header[key] = value

    url = "%s%s" % (host, uri)
    r = requests.request(method, url, data=body,
                         headers=header, cookies=cookie, verify=False)

    print("[response]: status=[%d],URL=[%s],data=[%s]" % (r.status_code, url, r.text))
    print("+++\n")

    return r.status_code, r.text


def get_company_token():
    url = "/oauthapi/v3/inner/company/token?app_id=%s" % (app_id)
    print("[request] url:", url, "\n")

    status, rsp = request("GET", openapi_host, url, None, None, None)
    rsp = json.loads(rsp)

    if rsp.__contains__('company_token'):
        return rsp["company_token"]
    else:
        print("no company-token found in response, authorized failed")
        exit(-1)


if __name__ == '__main__':
    # 获取token
    company_token = get_company_token()
```

## <span id="des4">Java代码示例</span>
``` java
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.client.methods.RequestBuilder;
import org.apache.http.client.utils.HttpClientUtils;
import org.apache.http.impl.client.HttpClients;
import org.bouncycastle.util.Strings;
import java.io.IOException;

public class WPS3Demo {
    
    public static String appId = "AK123";
    public static String appKey = "sk456";
    public static String url = "https://openapi.wps.cn/api/v1/dosomething?name=xiaoming&age=18";
    public static String uri = "/api/v1/dosomething?name=xiaoming&age=18";
    public static String data = "";
    
    public void main(String[] args) {
        //date  RFC1123格式
        String date = "Wed, 03 Nov 2021 02:55:55 GMT";
        //contentMd5
        String contentMd5 = DigestUtils.md5Hex(data);
        //content-type
        String contentType = "application/json";
        //AppKey + Content-Md5 + uri + Content-Type + Date
        String sign = DigestUtils.sha1Hex(appKey + contentMd5 + uri + contentType + date);
        String Auth = "WPS-3:" + appId + ":" + sign;

        /**
         * Date: Wed, 03 Nov 2021 02:55:55 GMT
         * Content-Md5: d41d8cd98f00b204e9800998ecf8427e
         * Content-Type: application/json
         * X-Auth: WPS-3:AK123:695229194add4899ffde601d691a1f2d398e7fab
         */
        HttpUriRequest request = RequestBuilder.get(url)
                .addHeader("Date", date)
                .addHeader("Content-Md5", contentMd5)
                .addHeader("Content-Type", contentType)
                .addHeader("X-Auth", Auth)
                .build();

        CloseableHttpResponse response = null;
        try {
            response = HttpClients.createDefault().execute(request);
            //todo 处理响应结果
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            HttpClientUtils.closeQuietly(response);
        }
    }
}
```