# Canvas Editor - Agent Development Guide

This guide provides essential information for agentic coding agents working on the canvas-editor repository.

## 业务二次开发架构约束（核心规范）

1. **二次开发定位**：本项目是基于 Canvas Editor 进行了深度二次开发的**结构化病历/报告设计与回显系统**。
2. **控件设计态操作**：所有数据占位符与控件的插入、配置均通过**【右侧数据控件面板】**（`#editor-aside-right`）及**【占位符与数据字典管理中心】**（`demo/component-management.html`）完成，通过点击或拖拽将绑有 `conceptId / fieldKey / path` 的字段插入编辑器。
3. **外部宿主与回显通信**：宿主系统（Parent Page）与编辑器的所有交互均通过标准的 SDK 协议（`EditorClient` / `postMessage`，如 `SET_CONTROL_VALUE`、`GET_CONTROL_VALUE` 等）进行数据下发与提取。
4. **数据驱动理念**：根据数据源类型（标量、一维数组、对象数组、嵌套数组）自动决定渲染形态（单字段、多段分段列表、多段勾选框、动态循环表格、自动单元格合并及单元格嵌套多图）。

## 严禁“拆东墙补西墙”：防退化开发准则与全局影响评估机制（核心铁律）

富文本与结构化控件底层高度交织联动，任何看似微小的按键拦截、删除逻辑或换行处理，若缺乏全局视野，极易导致“修好 A 控件却改崩 B 控件、修好编辑态却搞崩无痕态、修好段落却搞坏表格”的恶性退化。所有参与本项目的 Agent 和开发者必须严格遵守以下准则：

### 1. 修改前：全局场景影响评估矩阵（必查）
在动笔修改任何按键事件（Backspace / Delete / Enter）、控件行为或选区测算前，必须自查以下 5 大核心场景：
- **普通正文文本**：打字输入、普通回车换行、普通退格删除、跨行大选区删除、撤销重做（Undo/Redo）。
- **普通有内容控件（Text/Date/Select）**：当控件内部已有用户填写的实际内容时，花括号外按退格键**绝对不可误删整块控件**，必须安全将光标落入内容末尾逐步删除；回车必须保持普通换行行为。
- **列表与复合控件（List Text/Checkbox/Radio）**：在花括号后按退格时整块删除空或列表项控件；在非空项按回车时自动递增序号并克隆同类型未勾选控件；在连续空项按回车时安全退化退出列表。
- **表格内上下文（In-Table Context）**：单元格内按回车是否导致单元格高度撑高或异常跨页；单元格内控件的退格是否会破坏单元格元素结构（TD 起始/结束符）。
- **不同运行模式与视觉态**：`EDIT`（编辑态）、`CLEAN`（无痕/打印态，花括号不显示）、`READONLY`（只读态）、`FORM`（表单填写态）。

### 2. 开发中：三层精准隔离与防御原则
- **严禁粗暴一刀切**：绝对禁止直接在全局按键处理器根分支（如 `backspace.ts` 顶层、`enter.ts` 兜底）添加宽泛的 `return` 或拦截，必须使用最窄的条件判定（如 `controlComponent === ControlComponent.POSTFIX && isListControl`）。
- **专用逻辑收敛封装**：特定控件专属的键盘或渲染行为，必须抽取为独立纯函数（如 `tryHandleListControlEnter`、`getNextPrefixNumber`），并配合单元测试独立验证其边界条件。
- **选区与历史栈对称更新**：凡涉及批量插入、克隆控件或删除元素，必须严格确保 `range` 选区指向正确的落点，且不可丢失或污染编辑器的 Undo/Redo 历史快照。

### 3. 交付前：闭环全量回归验证规范（必测）
- **全量单元测试 100% 绿灯**：每次提交前必须在本地运行全量单测套件：
  ```bash
  npx vitest run
  ```
  保证全量 560+ 项测试完全通过，任何 1 项失败均视为不可接受的退化。
- **新增场景专门用例覆盖**：针对本次改动的核心场景，必须在 `tests/` 对应模块中新增自动化测试用例（覆盖正向操作、反向退格、极值空项、递增边界）。
- **静态类型与代码规范检查**：
  ```bash
  npm run lint && npm run type:check
  ```
  严禁引入任何 TypeScript 类型报错或 ESLint 警告。


## Project Overview

Canvas Editor is a TypeScript-based rich text editor library that renders content using HTML5 Canvas/SVG. It's built as an ES module with comprehensive TypeScript support and follows modern development practices.

## Development Commands

### Essential Commands
```bash
# Development
npm run dev                    # Start Vite dev server
npm run serve                  # Preview production build

# Building (includes lint + type check)
npm run lib                    # Build library for distribution
npm run build                  # Build application

# Code Quality
npm run lint                   # Run ESLint
npm run type:check            # TypeScript type checking

# Testing
npm run cypress:open          # Open Cypress test runner interactively
npm run cypress:run           # Run Cypress tests headless
```

### Pre-commit Hooks
- Automatically runs `npm run lint && npm run type:check` before commits
- Commit messages must follow conventional commit format (feat:, fix:, docs:, etc.)

## Code Style Guidelines

### Formatting Rules
- **No semicolons** - `semi: [1, "never"]`
- **Single quotes** - `quotes: [1, "single"]`
- **2-space indentation** - No tabs
- **80 character line limit** - `printWidth: 80`
- **No trailing commas** - `trailingComma: "none"`
- **Arrow function parentheses avoided** - `arrowParens: "avoid"`
- **LF line endings** - `endOfLine: "lf"`

### TypeScript Configuration
- **Strict mode enabled** - All type checking enforced
- **Target**: ESNext with modern features
- **Module system**: ESNext modules
- **Source maps**: Enabled for debugging
- **Unused locals/parameters**: Checked and reported

### ESLint Rules
- `any` type allowed (`@typescript-eslint/no-explicit-any: 0`)
- Console statements permitted
- Debugger statements allowed
- No explicit function return type required when inferred

## Project Structure

### Main Directories
```
src/
├── editor/                    # Core editor library
│   ├── index.ts              # Main entry point - exports Editor class
│   ├── core/                 # Core functionality
│   │   ├── draw/             # Canvas rendering engine
│   │   ├── command/         # Command pattern implementation
│   │   ├── listener/        # Event handling system
│   │   └── ...
│   ├── interface/            # TypeScript type definitions
│   ├── dataset/             # Constants and enums
│   │   ├── constant/        # Magic numbers and strings
│   │   └── enum/           # TypeScript enums
│   ├── utils/              # Editor-specific utilities
│   └── assets/             # CSS-in-JS and images
├── plugins/                 # Optional editor plugins
├── components/              # Reusable UI components
├── utils/                   # Shared utility functions
└── assets/                  # Static assets
```

### Key Files
- **Main entry**: `src/editor/index.ts` - Exports Editor class and utilities
- **Package exports**: ES module and UMD builds with TypeScript definitions
- **Node requirement**: `>=16.9.1`

## Import Conventions

### Module Imports
- Use ES module imports: `import { Editor } from './editor'`
- TypeScript interfaces: `import type { EditorInterface } from './interface'`
- Relative imports with explicit extensions for non-TypeScript files

### Import Organization
1. External libraries (Node.js built-ins, npm packages)
2. Internal modules (absolute imports from src/)
3. Relative imports (sibling/parent directory imports)
4. Type-only imports (use `import type` when possible)

## Naming Conventions

### Files and Directories
- **PascalCase** for components and classes: `EditorManager.ts`
- **camelCase** for utilities and functions: `formatText.ts`
- **kebab-case** for directories when containing multiple words: `rich-text/`

### Code Elements
- **PascalCase** for classes and interfaces: `class Editor`, `interface EditorConfig`
- **camelCase** for functions and variables: `formatText`, `currentSelection`
- **UPPER_SNAKE_CASE** for constants: `MAX_CANVAS_WIDTH`, `DEFAULT_FONT_SIZE`
- **PascalCase** for enums: `enum TextAlignment`

## Error Handling

### TypeScript Errors
- Use strict TypeScript checking - prefer explicit types over `any`
- Handle nullable types with optional chaining and nullish coalescing
- Use union types for variant error states

### Runtime Errors
- Throw descriptive Error objects with context
- Use try-catch blocks for external API calls
- Validate user input in public API methods

## Testing Guidelines

### Cypress E2E Tests
- Tests located in `cypress/` directory
- Use `npm run cypress:open` for interactive test development
- Use `npm run cypress:run` for CI/CD automated testing
- Viewport set to 1366x720 for consistency

### Test Organization
- Group related tests in describe blocks
- Use beforeEach for common setup
- Write descriptive test names that explain the behavior
- Test both happy path and error conditions

## Build Process

### Library Build
- TypeScript compilation with strict checking
- Vite bundling for ES module and UMD outputs
- Automatic CSS-in-JS injection via plugin
- Source maps generated for debugging

### Quality Gates
- Linting must pass before build completion
- Type checking must pass before build completion
- Pre-commit hooks enforce quality standards

## API Design

### Public API
- Main Editor class exported from `src/editor/index.ts`
- Fluent method chaining where appropriate
- Consistent parameter ordering (required, then optional)
- Comprehensive TypeScript definitions

### Plugin System
- Plugins in `src/plugins/` directory
- Extend Editor functionality without modifying core
- Follow established plugin patterns in codebase

## Development Workflow

1. **Start development**: `npm run dev`
2. **Make changes**: Follow code style guidelines
3. **Test changes**: Use Cypress for E2E testing
4. **Quality check**: `npm run lint && npm run type:check`
5. **Commit**: Pre-commit hooks will validate automatically
6. **Build**: `npm run lib` for distribution build

## Performance Considerations

- Canvas rendering optimized for frequent updates
- Minimal DOM manipulation - primarily Canvas-based
- Efficient event handling with delegation patterns
- Memory-conscious object pooling where appropriate

## Security Notes

- No external network requests in core library
- Sanitize all user input before rendering
- Avoid eval() and Function constructor usage
- Validate configuration options in public API