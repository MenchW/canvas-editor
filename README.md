<h1 align="center">Canvas Editor</h1>

## 目录

- [一、项目概述](#一项目概述)
- [二、功能特性](#二功能特性)
- [三、为什么选择 Canvas Editor？](#三为什么选择-canvas-editor)
- [四、项目目录结构](#四项目目录结构)
- [五、快速上手与启动指南](#五快速上手与启动指南)
- [六、二次开发指南与示例](#六二次开发指南与示例)
- [七、开发规范与注意事项](#七开发规范与注意事项)
- [八、生态系统](#八生态系统)
- [九、贡献与开源协议](#九贡献与开源协议)

---

## 一、项目概述

**Canvas Editor** 是一款基于 **TypeScript + HTML5 Canvas/SVG** 渲染架构的高性能、所见即所得（WYSIWYG）文档编辑器。专为对像素级渲染精度、高级排版、复杂布局以及 Word 式文档体验有极高要求的场景而设计 — 包括电子病历（EMR）、法律合同、专业报告等以文档为核心的企业级应用。

与传统的基于 DOM (`contenteditable`) 的编辑器不同，Canvas Editor 完全掌控了整个渲染流水线，使用 Canvas 结合矢量 SVG 绘制文本、表格、控件与水印，从而在不同浏览器间提供高度一致的排版效果、精准的文档分页以及统一的高保真打印导出体验。

如需获取完整的 API 文档，请参阅[官方文档](https://hufe.club/canvas-editor-docs)。

### 技术栈

- **核心语言**：TypeScript (严格类型检查)
- **构建工具**：Vite (提供极速的 HMR 开发体验与 ES Module / UMD 库打包)
- **代码规范**：ESLint + Prettier + Simple Git Hooks (自动化预提交校验)
- **测试框架**：Vitest (单元测试) + Cypress (E2E 端到端测试)
- **文档工具**：VitePress

---

## 二、功能特性

- **富文本能力** — 撤销 / 重做、字体、字号、加粗、斜体、下划线、删除线、上标/下标、对齐方式、标题样式、列表（有序/无序/任务列表）等
- **可插入元素** — 表格、图片、超链接、代码块、分页符、数学公式（LaTeX）、日期选择器、Block 块级元素
- **表单控件** — 下拉选择控件、文本输入控件、日期控件、单选控件、复选控件
- **分页机制** — 原生文档流分页，支持页眉、页脚及页码
- **页面布局** — 可配置页边距、水印、背景颜色与图片
- **文档结构** — 自动生成目录（TOC）、批注评论、分组标注
- **打印与导出** — 支持 Canvas 转图片、PDF 导出以及高保真原生打印
- **交互体验** — 自定义右键菜单、可配置快捷键、文本/元素/控件拖拽（Drag & Drop）
- **扩展性** — 灵活的插件系统，支持自建功能拓展
- **高性能** — 使用 Web Workers 处理字数统计、目录计算与异步数据检索

---

## 三、为什么选择 Canvas Editor？

| 维度         | Canvas Editor                 | contenteditable 编辑器            |
| ------------ | ----------------------------- | --------------------------------- |
| 跨浏览器渲染 | 像素级精准，完全一致          | 依赖各浏览器 DOM 实现，存在差异   |
| 分页机制     | 原生 Word 式文档流分页        | 需手动计算 / 不支持自然分页       |
| 打印保真度   | 严格与屏幕渲染保持一致        | 经常发生排版错乱或偏移            |
| 排版掌控力   | 100% 自研渲染流水线全控       | 受限于浏览器 DOM 盒模型限制       |
| 高级文档特性 | 目录、页眉/页脚、水印原生支持 | 依赖大量极其复杂的自定义 DOM 逻辑 |

---

## 四、项目目录结构

项目整体采用清晰的模块化架构，核心编辑器源码与示例运行环境相互解耦：

```
canvas-editor/
├── .github/                   # GitHub Actions 自动化工作流与 CI/CD 配置
├── .vscode/                   # VSCode 项目开发配置与推荐扩展
├── cypress/                   # Cypress E2E 端到端测试套件
├── docs/                      # VitePress 项目在线文档与说明源码
├── scripts/                   # 构建工具脚本 (commit 验证、发布前检查等)
├── src/                       # 核心源码与示例目录
│   ├── assets/                # 示例组件用到的样式与静态资源
│   ├── components/            # 编辑器弹窗 (Dialog)、签名 (Signature) 等辅助 UI 模块
│   ├── editor/                # 🌟 核心编辑器库源码
│   │   ├── index.ts           # 编辑器入口：导出 Editor 主类、类型及工具
│   │   ├── assets/            # 编辑器内部 CSS-in-JS 样式与图标
│   │   ├── core/              # 核心绘制逻辑与指令系统
│   │   │   ├── command/       # 命令模式实现 (文本样式、对齐、表格、插入元素等)
│   │   │   ├── draw/          # Canvas 画布绘制引擎 (光标、选区、背景、页眉页脚等)
│   │   │   ├── event/         # 鼠标、键盘、输入法等事件拦截与处理
│   │   │   ├── listener/      # 状态监听与变更广播系统
│   │   │   ├── position/      # 坐标计算、选区与定位管理
│   │   │   ├── register/      # 快捷键与右键菜单注册机制
│   │   │   ├── shortcut/      # 快捷键映射
│   │   │   └── zone/          # 编辑区域管理 (页眉、正文、页脚)
│   │   ├── dataset/           # 全局常量、默认配置与 TypeScript Enum 定义
│   │   │   ├── constant/      # 默认字体、字号、边距等硬编码常量
│   │   │   └── enum/          # 控件类型、元素类型、对齐方式等枚举定义
│   │   ├── interface/         # TypeScript 接口声明 (Element, Control, Watermark 等)
│   │   ├── types/             # 扩展类型定义
│   │   └── utils/             # 编辑器内部专属工具函数 (Canvas 绘图辅助、解析工具)
│   ├── plugins/               # 官方插件扩展目录
│   ├── utils/                 # 通用防抖、DOM 辅助与 Prism 代码高亮工具
│   ├── main.ts                # 示例项目的启动逻辑，绑定 DOM 交互事件与编辑器命令
│   ├── mock.ts                # 示例用初始文档数据、控件模拟数据及水印配置
│   ├── style.css              # 示例界面的工具栏与整体布局 CSS 样式
│   └── vite-env.d.ts          # Vite 环境变量声明
├── index.html                 # 示例项目 HTML 入口（包含完整的顶部工具栏与底部状态栏）
├── eslint.config.js           # ESLint 校验规则配置
├── package.json               # 项目依赖、指令集及 npm 导出配置
├── tsconfig.json              # TypeScript 编译选项配置
└── vite.config.ts             # Vite 打包构建配置 (同时配置 Dev / App / Lib 模式)
```

---

## 五、快速上手与启动指南

### 1. 安装依赖

```bash
# pnpm (推荐)
pnpm install

# npm
npm install
```

### 2. 本地启动开发服务

```bash
# 启动 Vite 本地开发服务器 (热更新)
npm run dev
```

启动成功后在浏览器打开 `http://localhost:3000/` 即可预览完整编辑器 demo。

### 3. 常用构建与测试指令列表

| 指令                   | 说明                                                        |
| :--------------------- | :---------------------------------------------------------- |
| `npm run dev`          | 启动本地 Vite 开发服务器（支持热更新）                      |
| `npm run build`        | 打包示例 Application 模式，用于预览部署 Demo                |
| `npm run lib`          | 构建打包发布给第三方引用的 Lib 库（输出 ESM 和 UMD Bundle） |
| `npm run serve`        | 本地预览 `npm run build` 产出的静态文件                     |
| `npm run lint`         | 执行 ESLint 语法检查与格式校验                              |
| `npm run type:check`   | 单独执行 TypeScript 类型校验                                |
| `npm run test:unit`    | 使用 Vitest 运行单元测试                                    |
| `npm run cypress:open` | 打开 Cypress 交互式 E2E 端到端测试面板                      |
| `npm run docs:dev`     | 本地启动 VitePress 在线文档开发服务                         |

---

## 六、二次开发指南与示例

通过修改 `index.html` 和 `src/main.ts` 可以轻松自定义菜单按钮、接入接口指令，以及扩展初始数据。

### 示例 1：添加一个自定义菜单按钮并调用 API

#### 步骤 1：在 `index.html` 中添加 HTML 节点

```html
<!-- index.html 中的工具栏模块内 -->
<div class="menu-item__custom-btn" title="插入提示文本">
  <button
    style="border:none; background:#4e6ef2; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;"
  >
    插入提示
  </button>
</div>
```

#### 步骤 2：在 `src/main.ts` 中绑定点击事件并调用编辑器指令

```typescript
// src/main.ts

// 1. 获取按钮 DOM 节点
const customBtnDom = document.querySelector<HTMLButtonElement>(
  '.menu-item__custom-btn button'
)!

// 2. 绑定点击事件，调用编辑器命令插入数据
customBtnDom.onclick = function () {
  instance.command.executeInsertElementList([
    {
      value: '【提示】：',
      bold: true,
      color: '#ff4d4f'
    },
    {
      value: '这是一段通过自定义按钮插入的带样式的提示文字。\n',
      color: '#1890ff',
      italic: true
    }
  ])
}
```

### 示例 2：修改默认初始内容与排版配置

```typescript
import Editor, { RowFlex } from './editor'
import { options } from './mock'

const container = document.querySelector<HTMLDivElement>('.editor')!
const instance = new Editor(
  container,
  {
    // 自定义页眉
    header: [
      {
        value: '我的自定义公司页眉',
        size: 14,
        rowFlex: RowFlex.CENTER
      }
    ],
    // 自定义正文元素
    main: [
      {
        value: '欢迎使用 Canvas Editor 二次开发！\n',
        size: 24,
        bold: true
      }
    ],
    // 自定义页脚
    footer: [
      {
        value: 'Page 1',
        size: 10,
        rowFlex: RowFlex.RIGHT
      }
    ]
  },
  {
    ...options,
    // 自定义编辑器默认配置
    pageNumber: {
      format: '{pageNo}/{pageCount}'
    },
    watermark: {
      data: '内部保密文档',
      color: '#e8e8e8',
      size: 80
    }
  }
)
```

---

## 七、开发规范与注意事项

### 1. 代码风格与 Lint 约束

本项目配置了严格的 ESLint 与 Prettier 规则：

- **无分号**（`semi: [1, "never"]`）
- **单引号**（`quotes: [1, "single"]`）
- **2 空格缩进**（不使用 Tab）
- **80 字符单行上限**（`printWidth: 80`）
- **无末尾逗号**（`trailingComma: "none"`）
- **LF 换行符**（`endOfLine: "lf"`）

在提交代码前，请主动运行 `npm run lint` 保证代码格式合规。

### 2. Git Commit 提交规范

项目集成了 `simple-git-hooks`，会在执行 `git commit` 时自动进行预提交校验 (`npm run lint && npm run type:check`)。

Commit Message 须遵守 **Conventional Commits** 规范：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档修改
- `style:` 代码格式变更
- `refactor:` 代码重构
- `test:` 测试用例修改

---

## 八、生态系统

| 项目                                                                       | 描述                               |
| :------------------------------------------------------------------------- | :--------------------------------- |
| [canvas-editor-plugin](https://github.com/Hufe921/canvas-editor-plugin)    | 官方插件集合库                     |
| [feature/svg](https://github.com/Hufe921/canvas-editor/tree/feature/svg)   | SVG 渲染层分支（开发中）           |
| [feature/pdf](https://github.com/Hufe921/canvas-editor/tree/feature/pdf)   | PDF 导出功能分支                   |
| [feature/ai](https://github.com/Hufe921/canvas-editor/tree/feature/ai)     | AI 辅助文本处理 Demo 分支          |
| [feature/CRDT](https://github.com/Hufe921/canvas-editor/tree/feature/CRDT) | 基于 CRDT 的协同编辑分支（实验性） |

---
