# ID 转换

WPS 开放平台于 2024 年 5 月上线了新版接口，新版接口与旧版接口标准存在差异，部分参数值不同。若应用已对接过旧版开放平台接口并获取了数据，在对接新版接口时，需要对新旧接口获取的数据做一层兼容匹配。
通过本接口，可将涉及新旧差异的参数进行新旧参数值转换，方便应用开发者做数据映射或清洗。

## ID 转换接口

使用前说明：

- 使用该接口时，需保证新旧数据获取的应用为同一个应用，即同一个 app_id。
- 该接口仅支持旧 id 转为新 id，不支持新 id 转为旧 id。

支持转换的 id 类型如下：

| **id_type 入参** | **返回新平台 id 类型** | **说明**                      |
|:---------------|:----------------|:----------------------------|
| company_id     | company_id      | 旧平台企业 id，转为新平台企业 id         |
| dept_id        | dept_id         | 旧平台部门 id，转为新平台部门 id         |
| company_uid    | user_id         | 旧平台企业用户 id，转为新平台 user_id    |
| open_id        | user_id         | 旧平台 open_id，转为新平台 user_id   |
| union_id       | user_id         | 旧平台 union_id，转为新平台 user_id  |
| group_id       | group_id        | 旧平台团队 id，转为新平台团队 id         |
| file_id        | file_id         | 旧平台文件/文件夹 id，转为新平台文件/文件夹 id |

### 请求说明

| **请求地址** | **https://openapi.wps.cn/v7/id_convert** |
|:---------|:-----------------------------------------|
| **请求方法** | POST                                     |
| **权限要求** | 无                                        |

### 请求头

| **Header 名称** | **参数类型** | **是否必填** | **说明**                           |
|:--------------|:---------|:---------|:---------------------------------|
| Content-Type  | string   | 是        | 使用：`application/json`            |
| Authorization | string   | 是        | 授权凭证，格式为：`Bearer {access_token}` |

### 请求体（Body）

| **名称**     | **类型**        | **是否必填** | **说明**                                                                                    |
|:-----------|:--------------|:---------|:------------------------------------------------------------------------------------------|
| id_type    | string[enum]  | 是        | id 类型 <br/>`company_id`；`dept_id`；`group_id`；`file_id`；`union_id`；`open_id`；`company_uid` |
| ids        | array[string] | 是        | 旧接口数据的 id 数组，最大长度 20                                                                      |
| company_id | string        | 否        | 旧接口数据的企业 id<br/>转换 company_uid 时，必传。                                                      |

### 请求地址示例

```
[POST] https://openapi.wps.cn/v7/id_convert
```

### 请求体示例

```json
{
  "id_type": "company_uid",
  "ids": [
    "Ao*****DE",
    "Bo*****DE",
    "Co*****DE"
  ],
  "company_id": "X*****E"
}
```

### 响应体

| **名称**             | **类型**                       | **说明**                                                                                    |
|:-------------------|:-----------------------------|:------------------------------------------------------------------------------------------|
| code               | integer                      | 响应代码。非 0 表示失败，参照[《状态码说明》](/app-integration-dev/wps365/server/api-description/errorcode) |
| data               | object[map]                  | 响应数据                                                                                      |
| ∟ src_id -> dst_id | key[string] -> value[string] | 键值对。key 为转换前的 id 值 `src_id`，value 为转换后的 id 值 `dst_id`                                     |

### 响应体示例

```json
{
  "data": {
    "Ao*****DE": "1*****o9",
    "Bo*****DE": "2*****o9",
    "Co*****DE": "3*****o9"
  },
  "code": 0
}
```