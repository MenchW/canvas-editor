# Canvas Editor 宿主系统 SDK 接入与通信指南

本指南面向**第三方业务系统**（Vue / React / 原生 HTML 工程），详细说明如何通过 **SDK** 接入、遥控与监听嵌入的 Canvas Editor。

---

## 📝 修订记录

| 版本号     | 修订日期   | 修订人             | 修订说明 |
| :--------- | :--------- | :----------------- | :------- |
| **v1.0.0** | 2026-08-13 | Canvas Editor Team | 初始版   |

---

## 📦 1. 架构说明

| 文件                                    | 线上部署地址示例                                                         |
| :-------------------------------------- | :----------------------------------------------------------------------- |
| **1. 编辑器静态应用 (`canvas-editor`)** | `https://open-web.hnocc.com/canvas-editor/index.html`                    |
| **2. 宿主 SDK (`report-design-sdk`)**   | `https://open-web.hnocc.com/canvas-editor/sdk/report-design-sdk.umd.cjs` |

---

## 🚀 2. 业务系统集成步骤

### 2.1 引入 SDK 与嵌入 <iframe> 节点

```html
<!-- 1. 业务系统index.html引入 SDK 脚本 -->
<script
  defer
  src="https://open-web.hnocc.com/canvas-editor/sdk/report-design-sdk.js"
></script>

<!-- 2. 嵌入 <iframe> 容器 -->
<div class="editor-container" style="width: 100%; height: 100vh;">
  <iframe
    id="canvas-editor-iframe"
    src="https://open-web.hnocc.com/canvas-editor/index.html"
    allowfullscreen="true"
    allow="fullscreen"
    sandbox="allow-scripts allow-same-origin allow-modals allow-popups allow-forms allow-downloads"
    style="width: 100%; height: 100%; border: none;"
  ></iframe>
</div>
```

### 2.2 实例化 SDK 与 TypeScript 类型定义

```typescript
/**
 * SDK 初始化配置选项接口 (ICanvasEditorHostOptions)
 */
export interface ICanvasEditorHostOptions {
  /** 1. 编辑器 iframe DOM 元素引用或 CSS 选择器 (必须) */
  iframe: HTMLIFrameElement | string

  /** 2. 系统应用 ID / 业务系统标识（用于保存模板 POST /system/report-template、获取组件字典 GET /system/component-dictionary/open/schema 接口统一取值鉴权） */
  appId?: string

  /** 3. 模式、功能开关、动态导出文件名等配置 */
  config?: {
    /** 初始模式: 'edit' (编辑) | 'print' (打印模式会解包展示占位符文本) | 'readonly' (只读无法编辑，占位符不会解包成文本) | 'preview_edit' (无痕编辑) */
    mode?: 'edit' | 'print' | 'readonly' | 'preview_edit' | string
    /** 动态导出 PDF/Word 文件名（支持字符串或动态计算函数；未配置时默认: 报告_${timestamp}） */
    exportFileName?: string | (() => string)
    /** 细粒度功能控制开关矩阵 */
    features?: {
      all?: boolean // 快捷通配符：设为 true 一键开启全部功能项，不建议开启，请根据实际场景进行配置
      save?: boolean // 保存按钮：默认 false (隐藏)
      print?: boolean // 打印按钮：默认 true (显示)
      export?: boolean // 导出菜单：默认 false (隐藏)
      control?: boolean // 表单控件工具组：默认 false (隐藏)
      asidePanel?: boolean // 右侧数据占位控件面板：默认 false (隐藏)
      modeSwitch?: boolean // 切换模式下拉框：默认 false (隐藏)
      comment?: boolean // 右键批注：默认 false (隐藏)
      signature?: boolean // 右键电子签名：默认 false (隐藏)
      macro?: boolean // 右键宏：默认 false (隐藏)
    }
  }

  /** 4.1 获取文档模板与排版参数 (必须) */
  getTemplate: () => Promise<{ data: any; options: any }>
  /** 4.2 获取表单控件与循环明细表格填充数据 (必须) */
  getData: () => Promise<Record<string, any>>
  /** 4.3 (可选) 宿主自定义覆写右侧占位符数据字典。默认已由编辑器根据 appId 直接请求接口：GET /system/component-dictionary/open/schema 获取 */
  getComponents?: () => Promise<Array<{ groupName: string; children: any[] }>>

  /** 5.1 保存按钮触发 Hook (编辑器会自动调用 POST /system/report-template 保存，同时上报宿主) */
  onSave?: (documentJson: any) => Promise<void> | void
  /** 5.2 打印按钮触发 Hook (返回 false 可阻止原生打印) */
  onPrint?: () => Promise<boolean | void> | boolean | void
  /** 5.3 图片/电子签名上传 Hook (接收 Base64，返回在线 OSS https 图片 URL) */
  onUploadImage?: (base64: string) => Promise<string>
  /** 5.4 导出按钮触发 Hook */
  onExport?: (type: string) => Promise<void> | void
  /** 5.5 模式切换触发 Hook */
  onModeChange?: (mode: string) => Promise<void> | void
}

// -------------------------------------------------------------
// 【业务系统】实例化示例
// -------------------------------------------------------------
const editorHost = new CanvasEditorHost({
  iframe: '#canvas-editor-iframe',
  appId: 'chvLlhGt7pKwvUom', // 传入所属业务系统的应用 ID，保存模板与获取字典接口统一通过此参数取值
  config: {
    mode: 'edit',
    features: { save: true, export: true, asidePanel: true }
  },
  getTemplate: async () => (await axios.get('/api/template')).data,
  getData: async () => (await axios.get('/api/record')).data,
  // 注：右侧字典组件面板由编辑器根据 appId 直连 /system/component-dictionary/open/schema 自动加载，无需再传 getComponents
  onSave: async data => await axios.post('/api/save', data),
  onUploadImage: async base64 =>
    (await axios.post('/api/upload', { base64 })).data.url
})
```

---

## 🛠️ 3. 业务系统主动调用 API 方法

业务系统通过 `editorHost` 实例可以主动调用以下方法操控编辑器：

### API 方法签名表 (`ICanvasEditorHost`)

缺少什么方法可以联系我添加

| API 方法                  | TS 方法签名                                                               | 说明                                                                                                |
| :------------------------ | :------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| **`setControlValueList`** | `setControlValueList(data?: Record<string, any> \| any[]): Promise<void>` | **批量填充控件与明细表格**。缺省参数时自动使用 `getData()` 的数据；也可手动下发最新的 KV 数据或数组 |
| **`getControlList`**      | `getControlList(): Promise<IControl[]>`                                   | **获取控件列表**。提取当前画布中所有表单/占位符控件核心配置结构列表（已自动提取 `control` 属性）    |
| **`getValue`**            | `getValue(): Promise<{ value: any; options: any } \| null>`               | **获取全文 JSON 数据**。返回当前文档正文 `value`（各节点）与画布排版 `options`                      |
| **`exportPdf`**           | `exportPdf(): Promise<void>`                                              | **触发导出 PDF**。直接唤起编辑器内内置导出 PDF 功能                                                 |
| **`print`**               | `print(): Promise<void>`                                                  | **触发打印面板**。唤起打印拦截 Hook 及打印面板                                                      |
| **`on`**                  | `on(event: string, listener: Function): void`                             | **订阅编辑器事件**                                                                                  |
| **`off`**                 | `off(event: string, listener: Function): void`                            | **取消订阅编辑器事件**                                                                              |
| **`destroy`**             | `destroy(): void`                                                         | **销毁 RPC 通信连接**                                                                               |

### 调用代码示例

```javascript
// 示例 1: 业务系统主动触发填充业务数据（使用 getData 接口）
await editorHost.setControlValueList()

// 示例 2: 手动下发增量更新数据
await editorHost.setControlValueList({
  patient_name: '张三',
  patient_age: '30岁'
})

// 示例 3: 获取当前文档内所有控件列表配置（已自动去除外层包裹，直接返回每个控件的 control 属性对象）
const controlList = await editorHost.getControlList()
console.log('控件列表:', controlList)
/* 输出格式示例:
[
  {
    "conceptId": "patient_name",
    "type": "text",
    "placeholder": "姓名",
    "value": [
      {
        "value": "张三"
      }
    ]
  }
]
*/

// 示例 4: 业务系统获取当前编辑器全文 JSON
const fullDoc = await editorHost.getValue()
console.log('正文节点:', fullDoc.value, '排版设置:', fullDoc.options)

// 示例 5: 触发导出 PDF
await editorHost.exportPdf()

// 示例 6: 页面销毁时解绑连接
editorHost.destroy()
```

---

## 👂 4. 业务系统事件监听机制 (`on` / `off`)

业务系统可通过 `editorHost.on(eventName, handler)` 实时监听编辑器发送给宿主的各类事件。

### 支持监听的事件列表

缺少什么事件可以联系我添加

| 事件名称 (`eventName`) | 触发时机                               | Callback 参数 (`payload`) 示例                 |
| :--------------------- | :------------------------------------- | :--------------------------------------------- |
| **`contentChange`**    | 画布正文文本或元素发生编辑变动时触发   | `{ wordCount: 128 }` (包含当前全文字数)        |
| **`modeChange`**       | 编辑器模式发生切换时触发               | `'edit'` \| `'readonly'` \| `'design'`         |
| **`controlChange`**    | 用户修改表单控件值或控件聚焦改变时触发 | `{ conceptId: 'patient_name', value: '李四' }` |
| **`pageScaleChange`**  | 页面缩放比例调整时触发                 | `{ scale: 1.25 }` (缩放倍率)                   |

### 监听代码示例

```javascript
// 1. 监听文档内容修改与字数统计
const handleContentChange = data => {
  console.log(`[业务系统] 收到内容变动，当前字数: ${data.wordCount}`)
}
editorHost.on('contentChange', handleContentChange)

// 2. 监听模式切换
editorHost.on('modeChange', newMode => {
  console.log(`[业务系统] 模式切换为: ${newMode}`)
})

// 3. 监听表单控件值修改
editorHost.on('controlChange', field => {
  console.log(`[业务系统] 控件 [${field.conceptId}] 值修改为:`, field.value)
})

// 4. 在需要时取消监听
editorHost.off('contentChange', handleContentChange)
```

---

## 📡 5. 业务系统 Provider 返回数据格式标准

### 5.1 `getTemplate()` 返回格式示例

```json
{
  "data": {
    "header": [],
    "main": [
      {
        "value": "第一人民医院门诊检查报告单",
        "size": 22,
        "bold": true,
        "rowFlex": "center"
      },
      {
        "value": "\n\n患者姓名：",
        "bold": true
      },
      {
        "value": "",
        "type": "control",
        "control": {
          "conceptId": "patient_name",
          "type": "text",
          "placeholder": "姓名",
          "value": []
        }
      },
      {
        "type": "table",
        "trList": [
          {
            "height": 42,
            "loopConfig": {
              "datasetId": "diagnose.laboratory_records",
              "isLoopRow": true
            },
            "tdList": [
              {
                "colspan": 1,
                "rowspan": 1,
                "value": [
                  {
                    "value": "",
                    "type": "control",
                    "control": {
                      "conceptId": "lab_item_name",
                      "type": "text",
                      "placeholder": "检测项目",
                      "value": []
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "footer": []
  },
  "options": {
    "mode": "edit",
    "width": 794,
    "height": 1123,
    "margins": [100, 100, 100, 100],
    "watermark": { "data": "CANVAS-EDITOR", "type": "text" },
    "pageNumber": { "format": "第{pageNo}页/共{pageCount}页" },
    "control": { "prefix": "{", "postfix": "}" }
  }
}
```

### 5.2 `getData()` 返回格式示例

```json
{
  "patient_name": "张三",
  "patient_gender": "男",
  "patient_age": "35岁",
  "patient_chief_complaint": "反复发热、咳嗽 3 天，体温最高 39.2℃。",
  "patient_avatar": "https://oss.company.com/avatar/zhangsan.png",
  "diagnose": {
    "laboratory_records": [
      {
        "lab_item_name": "白细胞计数 (WBC)",
        "lab_item_value": 11.2,
        "lab_item_unit": "10^9/L"
      },
      {
        "lab_item_name": "中性粒细胞比例 (NEUT%)",
        "lab_item_value": 82.5,
        "lab_item_unit": "%"
      }
    ]
  }
}
```

### 5.3 组件字典数据结构示例 (`GET /system/component-dictionary/open/schema?appId=...`)

编辑器内部会自动调用该接口拉取并渲染右侧数据源字典面板。接口返回的单分组对象或分组列表格式示例如下：

```json
{
  "id": 6,
  "appId": "c377fb213ad9703",
  "groupName": "食堂风险—养老院食堂报告",
  "systemName": "湖南省食品安全社会共治服务平台",
  "fieldList": [
    {
      "id": 39,
      "fieldName": "委托单位",
      "fieldKey": "client",
      "fieldType": "text",
      "defaultValue": "长沙市某某养老院",
      "children": []
    },
    {
      "id": 44,
      "fieldName": "标化分(实得分)",
      "fieldKey": "standardizedScore",
      "fieldType": "number",
      "defaultValue": "85.5",
      "children": []
    },
    {
      "id": 46,
      "fieldName": "风险规则列表",
      "fieldKey": "riskRuleList",
      "fieldType": "array",
      "description": "用于渲染风险级别勾选项明细表",
      "children": [
        {
          "fieldName": "是否勾选",
          "fieldKey": "checked",
          "fieldType": "checkbox"
        },
        {
          "fieldName": "规则描述",
          "fieldKey": "desc",
          "fieldType": "text"
        }
      ]
    },
    {
      "id": 49,
      "fieldName": "不符合项汇总明细",
      "fieldKey": "groupedProblems",
      "fieldType": "array",
      "children": [
        {
          "fieldName": "类别名称",
          "fieldKey": "categoryName",
          "fieldType": "text"
        },
        {
          "fieldName": "具体描述",
          "fieldKey": "detailText",
          "fieldType": "text"
        }
      ]
    }
  ]
}
```

### 5.4 图片控件与单元格多图数据格式规范

宿主系统通过 `getData()` 或 `setControlValueList(data)` 下发图片数据时，支持以下格式：

#### 1. 单图控件（如患者头像 `patient_avatar`）

```json
{
  "patient_avatar": "https://oss.company.com/avatar/zhangsan.png"
}
```

_注：支持在线 https 图片 URL 或 Base64 格式。_

#### 2. 表格单元格内多图 / 单图控件（如 `lab_item_chart` 或 `photos`）

宿主端在明细表格记录中，支持以下 3 种格式传递：

- **格式 A（推荐，URL 字符串数组）**：
  ```json
  {
    "lab_item_chart": [
      "https://oss.company.com/chart1.png",
      "https://oss.company.com/chart2.png"
    ]
  }
  ```
- **格式 B（对象数组）**：
  ```json
  {
    "lab_item_chart": [
      { "url": "https://oss.company.com/chart1.png" },
      { "url": "https://oss.company.com/chart2.png" }
    ]
  }
  ```
- **格式 C（单张图片字符串）**：
  ```json
  {
    "lab_item_chart": "https://oss.company.com/chart1.png"
  }
  ```

#### 3. 占位符保留规则（无图片或空数据）

- 当字段值为 **`[]`（空数组）**、**`null`**、**`undefined`** 或 **`""`（空字符串）** 时，编辑器**不会解包**，画布上会自动保留并展示图片占位符（如 `【@示意图表】`）。
- 此时调用 `getControlList()`，将返回 `placeholder: "示意图表"` 与 `value: []`，便于宿主识别该项尚未填值。
