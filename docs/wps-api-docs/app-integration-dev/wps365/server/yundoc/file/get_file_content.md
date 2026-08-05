# 文档内容抽取

# 文档内容抽取

**标签**：`文件` 

## 请求说明
| 字段          | 值                  |
|--------------|---------------------|
| **请求地址
**  | https://openapi.wps.cn/v7/drives/{drive_id}/files/{file_id}/content          |
| **HTTP 方法
** | `GET`    |
| **接口描述
**  | 文档内容抽取 |
| **签名方式
**  | [KSO-1](https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description) |
| **限频策略
** | 无 |
| **权限要求
** | 查询和管理文件(应用授权) `kso.file.readwrite`

查询文件(应用授权) `kso.file.read`

查询和管理文件(用户授权) `kso.file.readwrite`

查询文件(用户授权) `kso.file.read`

## 路径参数 (Path)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| drive_id
 | `string` | 是 |  | - 
| file_id
 | `string` | 是 |  | - 

## 查询参数 (Query)
| 属性名 | 类型 | 是否必填 | 描述 | 可选值 |
|-------|------|------|-------|-------|
| format
 | `string` | 否 | 文档内容目标格式 | `kdc`, `plain`, `markdown` 
| include_elements
 | `array` | 否 | 指定抽取元素。默认元素为para，且一定会被导出；其余附加元素根据请求参数选择性导出。 | `para`, `table`, `component`, `textbox`, `all` 
| mode
 | `string` | 否 | 接口模式。sync-同步模式，默认；async-异步模式，启用该模式后，内容抽取转为异步处理；auto-自动模式，启用该模式后，耗时较长的内容抽取任务将自动转为异步处理。 | `sync`, `async`, `auto` 
| task_id
 | `string` | 否 | 异步任务id，用于内容抽取任务的结果查询，在mode=async/auto时生效。 | - 

## 响应体(Response)
**HTTP状态码:** `200`

**响应体格式:** `application/json`
文档内容抽取信息响应体
task_status: 任务状态，在mode=async/auto时返回。
\n,doc: 文字类的结构化数据，源格式为’otl’、'pdf’和’docx’并且目标格式为’kdc’时适用，《KDC规范》：https://365.kdocs.cn/l/caW2QBdM4bjJ
\n,x2: right-bottom 点 x坐标
\n,y1: left-top 点 y坐标
\n,y2: right-bottom 点 y坐标
\ncomponent: 块类型为component时适用
\n,type: component类型枚举
\n\nimage - 图片
\naudio - 音频
\nvideo - 视频
\n\nid: 块ID
\n,index: 当前块的索引
\n,page_index: 当前块所在的页索引，从0开始
\n,para: 块类型为para时适用
\n,def_run_prop: 默认句属性
\n,color: 颜色， RGBA 16进制描述，例如：#FF0000FF; 最后两位为透明度
\n,font_ascii: 西文字体名
\n,font_east_asia: 东亚字体名
\n,size: 大小， 单位磅
\nlist_string: 段落上的项目编号字符串
\n,outline_level: 大纲级别, 1-9 表示级别1-级别9， 10表示正文。若段落在表格内，则忽略此属性
\nruns: 句列表
\n,prop: 句属性
\n,color: 颜色， RGBA 16进制描述，例如：#FF0000FF; 最后两位为透明度
\n,font_ascii: 西文字体名
\n,font_east_asia: 东亚字体名
\n,size: 大小， 单位磅
\ntext: 文本内容
\nrotate: 当前块的旋转角度
\n,table: 块类型为table时适用
\n,col_span: 水平方向（向右）合并的单元格数量
\n,id: 单元格 ID
\n,row_span: 垂直方向（向下）合并的单元格数量
\ntags: tag列表
\n,value: 值
\ntextbox: 块类型为textbox时适用
\ntype: 块类型枚举
\n\npara - 段落
\ntable - 表格
\ntextbox - 文本框
\ncomponent - 部件（图片、音视频、脑图、流程图等）
\n\nreferences: -,type: ID 类型
\nmedias: 媒体文件
\n,id: -,url: 媒体数据，url链接形式，数据存放在外部,  data和url两者选一
\nprop: 文档的属性和元数据
\n,page_props: 文档所有页的基本信息
\n,offset_angle: 扫描件的旋转小角度
\n,rotate: 页面与内容的旋转角度枚举，90度的正整数倍
\n,size: 页大小，单位磅
\n,width: 宽度
\ntree: 文档数据树状结构表示，以大纲级别为层级
\n,children: 子节点
\n,outline_level: 大纲级别, 1-9 表示级别1-级别9， 10表示正文，同段落属性中的大纲级别
\ndst_format: 目标格式
\n\nkdc - 结构化表示
\nplain - 纯文本
\nmarkdown - markdown
\n\n,markdown: markdown内容数据，目标格式为’markdown’时适用
\n,plain: 纯文本内容数据，目标格式为’plain’时适用
\n,src_format: 源格式
\n\notl - 智能文档
\npdf - pdf文档
\ndocx - 后缀为docx的word文档
\n\n,version: 版本号，初始版本1.0.0
\ncode: -,msg: 人可阅读的文本信息，可能会按不同的语言或地区返回不同的文本信息。
\n,]' />

## 响应体示例
```json
{
  "data": {
    "task_id": "string",
    "task_status": "success",
    "doc": {
      "comments": [
        {
          "blocks": [
            {
              "bounding_box": {
                "x1": 0,
                "x2": 0,
                "y1": 0,
                "y2": 0
              },
              "component": {
                "media_id": "string",
                "type": "image"
              },
              "id": "string",
              "index": 0,
              "page_index": 0,
              "para": {
                "prop": {
                  "alignment": "left",
                  "def_run_prop": {
                    "bold": true,
                    "color": "string",
                    "font_ascii": "string",
                    "font_east_asia": "string",
                    "size": 0
                  },
                  "list_string": "string",
                  "outline_level": 0
                },
                "runs": [
                  {
                    "id": "string",
                    "prop": {
                      "bold": true,
                      "color": "string",
                      "font_ascii": "string",
                      "font_east_asia": "string",
                      "size": 0
                    },
                    "text": "string"
                  }
                ]
              },
              "rotate": 0,
              "table": {
                "rows": [
                  {
                    "cells": [
                      {
                        "blocks": [
                          {}
                        ],
                        "col_span": 0,
                        "id": "string",
                        "row_span": 0
                      }
                    ]
                  }
                ]
              },
              "tags": [
                {
                  "name": "string",
                  "value": "string"
                }
              ],
              "textbox": {
                "blocks": [
                  {}
                ]
              },
              "type": "para"
            }
          ],
          "references": [
            {
              "id": "string",
              "type": "run"
            }
          ]
        }
      ],
      "medias": [
        {
          "data": "string",
          "id": "string",
          "url": "string"
        }
      ],
      "prop": {
        "page_count": 0,
        "page_props": [
          {
            "dpi": 0,
            "offset_angle": 0,
            "rotate": 0,
            "size": {
              "height": 0,
              "width": 0
            }
          }
        ]
      },
      "tree": {
        "blocks": [
          {}
        ],
        "children": [
          {}
        ],
        "outline_level": 0
      }
    },
    "dst_format": "kdc",
    "markdown": "string",
    "plain": "string",
    "src_format": "docx",
    "version": "string"
  },
  "code": 0,
  "msg": "string"
}
```