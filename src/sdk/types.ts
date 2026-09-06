import type { EditorMode } from '../editor/dataset/enum/Editor'
import type { IControl } from '../editor/interface/Control'

/** 支持的 9 种编辑器模式字面量类型 */
export type TEditorMode = EditorMode | `${EditorMode}`
export type { IControl } from '../editor/interface/Control'

/** 编辑器内部 Bridge 网关配置选项 */
export interface IBridgeOptions {
  instance: any
  updateComponents?: (components: any[]) => void
  setCustomConfig?: (config: any) => void
}

/** 宿主 SDK 初始化选项 */
export interface IEditorClientOptions extends IHostHooks {
  /** 编辑器 iframe DOM 元素引用或 CSS 选择器 */
  iframe: HTMLIFrameElement | string

  /** 系统应用 ID / 业务系统标识（用于保存模板、拉取组件字典等接口鉴权取值） */
  appId?: string

  /** 模式、面板显示、功能开关等配置 */
  config?: {
    /** 初始渲染使用的编辑器模式 */
    mode: TEditorMode
    /** 顶部功能栏/工具栏显示开关 (默认: true) */
    header?: boolean
    /** 底部功能栏/状态栏显示开关 (默认: true) */
    footer?: boolean
    /** 目录面板及底部目录开关显示开关 (默认: true) */
    catalog?: boolean
    features?: boolean | IFeatureConfig
    /** 动态导出文件名（支持固定字符串或动态生成函数；未配置时默认: 报告_${timestamp}） */
    exportFileName?: string | (() => string)
    [key: string]: any
  }

  /** 模板 JSON 获取接口 */
  getTemplate?: (() => Promise<any> | any) | any
  /** 结构化业务数据获取接口 */
  getData?:
    | (() => Promise<Record<string, any>> | Record<string, any>)
    | Record<string, any>
  /** 右侧插入占位符组件列表获取接口（可选，默认编辑器内部根据 appId 直连 /system/component-dictionary/open/schema 获取） */
  getComponents?:
    | (() => Promise<TComponentList> | TComponentList)
    | TComponentList
}



/** 控件与业务数据对齐及值有效性校验结果 */
export interface IControlDataAuditResult {
  /** 字段 Key 缺失的控件列表（画布控件中存在，但宿主数据中完全未声明该 Key） */
  missingControls: IControl[]
  /** 字段 Key 存在但值为假值（排除 0 和 false，如 null, undefined, '', 空数组等）的控件列表 */
  falsyControls: IControl[]
  /** 别名：missControls (对应 miss) */
  missControls: IControl[]
  /** 别名：falseControls (对应 falseControls) */
  falseControls: IControl[]
}

/**
 * SDK暴露给宿主调用的公开 API
 */
export interface IEditorClient {
  /**
   * 获取当前编辑器的全文数据 JSON（包含 value 与 options）
   */
  getValue(): Promise<{ value: any; options: any } | null>

  /**
   * 批量填充表单/占位符控件数据
   * @param data 可为键值对对象、嵌套结构化对象或 [{ conceptId, value }] 数组，缺省时自动使用 getData() 的数据
   */
  setControlValueList(data?: Record<string, any> | any[]): Promise<void>

  /**
   * 获取当前画布中的所有表单/占位符控件列表（提取控件核心配置结构）
   */
  getControlList(): Promise<IControl[]>

  /**
   * 检查宿主业务数据与画布控件列表的字段对齐及值有效性情况
   * 支持手动传入 template 和 data；缺省时自动从 getTemplate / getData 中查找；若均无则返回异常错误
   * @param optionsOrTemplateOrData 可为 { template?: any, data?: any }、或手动传入的 template/data
   * @param customData 当首参为 template 时，次参为可选的业务数据
   * @returns 包含 missingControls (字段缺失) 和 falsyControls (除0和false外的假值) 的结果对象
   */
  getMissingControlList(
    optionsOrTemplateOrData?: { template?: any; data?: any } | any,
    customData?: Record<string, any>
  ): Promise<IControlDataAuditResult>


  /**
   * 订阅编辑器事件（如 contentChange, modeChange, export 等）
   * @param event 事件名称
   * @param listener 事件回调函数
   */
  on(event: string, listener: (...args: any[]) => void): void

  /**
   * 取消订阅编辑器事件
   * @param event 事件名称
   * @param listener 绑定的回调函数
   */
  off(event: string, listener: (...args: any[]) => void): void

  /**
   * 销毁跨窗口 RPC 通信连接
   */
  destroy(): void
}



/** 宿主配置的细粒度功能控制开关 */
export interface IFeatureConfig {
  /** 快捷通配符：设为 true 一键开启全部功能 */
  all?: boolean
  /** 顶部功能栏/工具栏 (默认: true 开启；设为 false 时彻底隐藏顶部菜单栏并自适应收紧画布边距) */
  header?: boolean
  /** 顶部功能栏/工具栏别名 (等价于 header) */
  toolbar?: boolean
  /** 底部功能栏/状态栏 (默认: true 开启；设为 false 时彻底隐藏底部状态栏并自适应贴底) */
  footer?: boolean
  /** 底部功能栏/状态栏别名 (等价于 footer) */
  statusBar?: boolean
  /** 目录面板及底部目录开关 (默认: true 开启；设为 false 时彻底隐藏目录面板与底部目录按钮) */
  catalog?: boolean
  /** 保存按钮 (默认: false 隐藏) */
  save?: boolean
  /** 打印按钮 (默认: true 开启) */
  print?: boolean
  /** 导出按钮菜单 (默认: true 开启) */
  export?: boolean | { pdf?: boolean; docx?: boolean; image?: boolean }
  /** 表单控件插入工具组 (默认: false 隐藏) */
  control?: boolean
  /** 右侧数据占位控件面板 (默认: false 隐藏) */
  asidePanel?: boolean
  /** 底部模式切换下拉框 (默认: false 禁用/隐藏切换) */
  modeSwitch?: boolean
  /** 右键菜单-批注 (默认: false 隐藏) */
  comment?: boolean
  /** 右键菜单-电子签名 (默认: false 隐藏) */
  signature?: boolean
  /** 右键菜单-宏 (默认: false 隐藏) */
  macro?: boolean
}

/** 右侧占位符面板字段类型 */
export type TComponentFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'image'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'array'
  | 'object'

/** 面板字段候选项 (select/checkbox/radio 使用) */
export interface IComponentFieldOption {
  label: string
  value: string
}

/**
 * 右侧占位符面板字段（支持数组/对象嵌套与全路径寻址）
 * - path 为完整取值路径（如 records[*].patient.name），缺省时子系统按祖先链自动拼接；
 * - 支持 records[*].xxx 数组通配、records[0].xxx 索引、多层嵌套；
 * - 侧边栏展示时自动扁平化（折叠组 + 面包屑前缀）。
 */
export interface IComponentField {
  conceptId: string
  /** 中文名称 */
  name?: string
  type: TComponentFieldType
  /** 完整取值路径，缺省时按祖先链自动拼接 */
  path?: string
  /** array/object 类型的子字段 */
  children?: IComponentField[]
  /** select/checkbox/radio 候选项 */
  options?: IComponentFieldOption[]
  /** date 显示格式（如 yyyy-MM-dd） */
  dateFormat?: string
  /** image 占位宽（默认 120） */
  width?: number
  /** image 占位高（默认 120） */
  height?: number
}

/** 右侧占位符面板分组 */
export interface IComponentGroup {
  groupName: string
  collapsed?: boolean
  children: IComponentField[]
}

/** 右侧占位符面板数据：分组数组或平铺字段数组 */
export type TComponentList = (IComponentGroup | IComponentField)[]

/** Toast 消息提示组件接口 */
export interface IToast {
  show(
    options:
      | {
          message: string
          type?: 'success' | 'error' | 'warning' | 'info' | 'loading'
          duration?: number
        }
      | string
  ): () => void
  success(message: string, duration?: number): () => void
  error(message: string, duration?: number): () => void
  warning(message: string, duration?: number): () => void
  info(message: string, duration?: number): () => void
  loading(message: string, duration?: number): () => void
}

/** 宿主系统响应 Hooks */
export interface IHostHooks {
  /** 保存回调 Hook (必传，支持接收全文 JSON 与 toast 消息提示工具) */
  onSave: (documentJson: any, toast: IToast) => Promise<void> | void
  /** 打印回调 Hook (返回 false 可阻止编辑器默认打印) */
  onPrint?: (e?: any) => Promise<boolean | void> | boolean | void
  /** 导出回调 Hook */
  onExport?: (type: string) => Promise<void> | void
  /** 模式切换回调 Hook */
  onModeChange?: (mode: string) => void
  /** 图片/签名上传 Hook：宿主将 base64 上传至 OSS 并返回在线 https 地址 */
  onUploadImage?: (base64: string) => Promise<string> | string
}

/** 宿主系统暴露给编辑器子窗口调用的方法 (跨 iframe Penpal RPC 通道) */
export interface IHostRpcMethods {
  [key: string]: any
  /** 保存回调 */
  onSave?: (documentJson: any) => Promise<void> | void
  /** 打印回调 (返回 false 可阻止编辑器默认打印) */
  onPrint?: (e?: any) => Promise<boolean | void> | boolean | void
  /** 导出回调 */
  onExport?: (type: string) => Promise<void> | void
  /** 模式切换回调 */
  onModeChange?: (mode: string) => void
  /** 图片/签名上传 Hook */
  onUploadImage?: (base64: string) => Promise<string> | string
  /** 编辑器点击错误遮罩重新加载时触发 */
  onRetry?: () => Promise<void> | void
  /** 编辑器内部通用事件代理分发 */
  onEvent?: (eventName: string, data: any) => void
}

/** 编辑器暴露给宿主系统调用的方法 */
export interface IEditorRpcMethods {
  setCustomConfig(config: any): Promise<void> | void
  setError(msg?: string): Promise<void> | void
  setControlValueList(payload: any): Promise<void> | void
  render(payload: any): Promise<void> | void
  /** 宿主按钮触发:回显结构化业务数据 */
  fillData(): Promise<void> | void
  updateComponents(components: TComponentList): Promise<void> | void
  executePrint(): Promise<void> | void
  executeExportPdf(fileName?: string): Promise<void> | void
  getValue(): { value: any; options: any }
  getControlList(): any[]
}
