/**
 * @file 宿主客户端 SDK 模块
 * @version 1.0.3
 * @author menchw
 * @updateTime 2026-09-05
 */

import { connect, WindowMessenger } from 'penpal'
import { EditorMode } from '../editor/dataset/enum/Editor'
import type {
  IToast,
  IEditorClient,
  IEditorClientOptions,
  IEditorRpcMethods,
  IControl,
  IControlDataAuditResult
} from './types'

import { CanvasDataTransform } from './transforms'
import { getValueByPath } from '../editor/utils/index'
import { toast } from '../components/toast/Toast'
import { debugTableEcho } from '../utils/debugTable'

export { toast, EditorMode, CanvasDataTransform, debugTableEcho }
export const debugTable = debugTableEcho
export type {
  IToast,
  IEditorClient,
  IEditorClientOptions,
  IFeatureConfig,
  TEditorMode,
  IControl,
  IControlDataAuditResult
} from './types'

type EventListener = (...args: any[]) => void

/**
 * EditorClient 宿主客户端 SDK 类
 * 用于在父页面嵌入编辑器 iframe 并建立跨窗口通信
 */
export class EditorClient implements IEditorClient {
  /** 快捷数据转换适配工具集 */
  public static transform = CanvasDataTransform
  /** 全局 Toast 提示工具 */
  public static toast: IToast = toast

  private iframeEl: HTMLIFrameElement | null = null
  private editorRpc: IEditorRpcMethods | null = null
  private connection: any = null
  private options: IEditorClientOptions
  private eventListeners: Map<string, Set<EventListener>> = new Map()
  private lastFilledData: Record<string, any> | null = null

  /**
   * 构造函数
   * @param options 初始化配置对象，包含 iframe 选择器、数据 Providers 和 Hook 回调
   */
  constructor(options: IEditorClientOptions) {
    this.options = options
    this.initIframe()
    this.initPenpalConnection()
  }

  /**
   * 获取 iframe DOM 元素
   */
  private initIframe() {
    this.iframeEl =
      typeof this.options.iframe === 'string'
        ? document.querySelector<HTMLIFrameElement>(this.options.iframe)
        : this.options.iframe
  }

  /**
   * 建立跨窗口 RPC 通信
   */
  private async initPenpalConnection() {
    if (!this.iframeEl || !this.iframeEl.contentWindow) {
      if (!this.iframeEl) {
        console.error('[EditorClient SDK] 未找到指定的 iframe 节点')
      }
      return
    }

    this.connection = connect({
      messenger: new WindowMessenger({
        remoteWindow: this.iframeEl.contentWindow!,
        allowedOrigins: ['*']
      }),
      // 暴露给 iframe 的方法
      methods: {
        // 编辑器点击错误遮罩重新加载时，重新拉取宿主数据并渲染
        onRetry: async () => {
          await this.fetchAndRender()
        },
        // 打印 Hook
        onPrint: async () => {
          return this.options.onPrint ? await this.options.onPrint() : true
        },
        // 保存 Hook
        onSave: async (documentJson: any) => {
          await this.options.onSave(documentJson, toast)
        },
        // 导出 Hook
        onExport: async (type: string) => {
          await this.options.onExport?.(type)
          this.emit('export', type)
        },
        // 图片/签名上传 Hook：宿主将 base64 上传至 OSS 并返回在线 https 网址
        onUploadImage: async (base64: string) => {
          if (this.options.onUploadImage) {
            return await this.options.onUploadImage(base64)
          }
          return base64
        },
        // 模式切换 Hook
        onModeChange: async (mode: string) => {
          this.options.onModeChange?.(mode)
          this.emit('modeChange', mode)
        },
        // 统一事件代理分发器 (接收 contentChange, controlChange 等)
        onEvent: (eventName: string, data: any) => {
          this.emit(eventName, data)
        }
      }
    })

    try {
      this.editorRpc = (await this.connection.promise) as IEditorRpcMethods

      if (this.editorRpc) {
        const mergedConfig = {
          ...this.options.config,
          ...(this.options.appId ? { appId: this.options.appId } : {})
        }
        await this.editorRpc.setCustomConfig(mergedConfig)
      }

      // 连接成功后自驱动拉取数据并渲染
      await this.fetchAndRender()
    } catch (err) {
      console.error('[EditorClient SDK] 与 Editor 建立通信连接失败:', err)
    }
  }

  /**
   * 聚合加载并一次性渲染（保持 Loading 直到模板与数据全部就绪，避免局部空白与结构跳变）：
   * 1. 并发请求模板、业务数据与组件字典；
   * 2. 细粒度捕获每个接口的独立异常，提供精准 Toast 与错误遮罩提示（告别 Promise.all 一损俱损无提示问题）；
   * 3. 核心资源全部就绪后一次性交付渲染，完整展开表格与全部回显值。
   */
  private async fetchAndRender(): Promise<void> {
    if (!this.editorRpc) return
    const { getTemplate, getData, getComponents } = this.options

    let template: any = null
    let businessData: any = null
    let componentList: any = null
    let templateFetchError: string | null = null

    // 1. 任务 A：模板拉取通道
    const fetchTemplatePromise = (async () => {
      if (!getTemplate) return
      try {
        template =
          typeof getTemplate === 'function' ? await getTemplate() : getTemplate
      } catch (err: any) {
        const errMsg =
          err?.message || err?.msg || String(err) || '模板加载接口异常'
        console.error('[EditorClient SDK] 报告模板加载失败:', err)
        templateFetchError = `【报告模板】: ${errMsg}`
        toast.error(`报告模板加载失败: ${errMsg}`)
      }
    })()

    // 2. 任务 B：业务数据拉取通道
    const fetchDataPromise = (async () => {
      if (!getData) return
      try {
        businessData = typeof getData === 'function' ? await getData() : getData
        if (
          businessData &&
          typeof businessData === 'object' &&
          !Array.isArray(businessData)
        ) {
          this.lastFilledData = businessData
        }
      } catch (err: any) {
        const errMsg =
          err?.message || err?.msg || String(err) || '业务数据接口异常'
        console.error('[EditorClient SDK] 业务数据加载失败:', err)
        toast.error(`业务数据加载失败: ${errMsg}`)
      }
    })()

    // 3. 任务 C：组件字典拉取通道（非关键资源）
    const fetchComponentsPromise = (async () => {
      if (!getComponents) return
      try {
        const comps =
          typeof getComponents === 'function'
            ? await getComponents()
            : getComponents
        if (Array.isArray(comps)) {
          componentList = comps
        }
      } catch (err: any) {
        console.warn('[EditorClient SDK] 数据字典加载异常:', err)
        toast.warning('数据字典加载异常，部分控件可能无法从右侧面板拖拽')
      }
    })()

    // 等待所有接口全部响应完成
    await Promise.all([
      fetchTemplatePromise,
      fetchDataPromise,
      fetchComponentsPromise
    ])

    // 只有在模板接口真实抛错时，才在遮罩层上展示错误提示并中断渲染
    if (templateFetchError) {
      await this.editorRpc?.setError(templateFetchError)
      return
    }

    // 模板归一化：若返回为空字符串/null/undefined，代表新建/空白模板，优雅以空白结构渲染
    let finalTemplate = template
    if (!finalTemplate || typeof finalTemplate !== 'object') {
      finalTemplate = { data: { main: [] } }
    }

    // 核心数据全部就绪：合并为完整 Payload 一次性下发给编辑器，完成整屏完美回显与表格展开
    console.log('[EditorClient SDK] 整屏渲染:', {
      template,
      businessData,
      componentList
    })

    try {
      await this.editorRpc.render({
        template: finalTemplate,
        businessData: businessData || {},
        ...(componentList ? { componentList } : {})
      })
    } catch (renderErr: any) {
      console.error('[EditorClient SDK] 整屏渲染失败:', renderErr)
      const renderErrMsg =
        renderErr?.message || renderErr?.msg || '文档渲染失败'
      toast.error(`文档渲染失败: ${renderErrMsg}`)
      await this.editorRpc?.setError(`文档渲染失败: ${renderErrMsg}`)
    }
  }

  /**
   * 内部事件触发
   */
  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach(fn => fn(...args))
  }

  // ============================================================================
  // 公开 API 方法
  // ============================================================================

  /**
   * 获取当前编辑器的全文数据 JSON（包含 value 与 options）
   */
  public async getValue(): Promise<{ value: any; options: any } | null> {
    return this.editorRpc ? await this.editorRpc.getValue() : null
  }

  /**
   * 批量填充表单/占位符控件数据
   */
  public async setControlValueList(
    data?: Record<string, any> | any[]
  ): Promise<void> {
    if (!this.editorRpc) return
    let targetData = data
    if (!targetData && this.options.getData) {
      targetData =
        typeof this.options.getData === 'function'
          ? await this.options.getData()
          : this.options.getData
    }
    if (
      targetData &&
      typeof targetData === 'object' &&
      !Array.isArray(targetData)
    ) {
      this.lastFilledData = targetData
    }
    await this.editorRpc.setControlValueList(targetData)
  }

  /**
   * 从模板数据中提取顶层表单/占位符控件列表（遇到表格跳过内部 tr/td，提取表格本身名称和 key）
   */
  private extractControlsFromTemplate(template: any): IControl[] {
    if (!template || typeof template !== 'object') return []

    const rawData = template.data || template
    const lists: any[][] = []
    if (Array.isArray(rawData)) {
      lists.push(rawData)
    } else if (typeof rawData === 'object') {
      if (Array.isArray(rawData.header)) lists.push(rawData.header)
      if (Array.isArray(rawData.main)) lists.push(rawData.main)
      if (Array.isArray(rawData.footer)) lists.push(rawData.footer)
    }

    const parseTableControl = (el: any): IControl | null => {
      const tableKey =
        el.conceptId ||
        el.datasetId ||
        el.fieldKey ||
        el.code ||
        (Array.isArray(el.trList)
          ? el.trList.find((tr: any) => tr?.loopConfig?.datasetId)?.loopConfig?.datasetId
          : '') ||
        ''
      const tableName =
        el.name ||
        el.placeholder ||
        el.label ||
        el.fieldName ||
        el.title ||
        tableKey ||
        '表格'

      if (el.control && typeof el.control === 'object') {
        return {
          ...el.control,
          conceptId: el.control.conceptId || tableKey,
          placeholder: el.control.placeholder || tableName
        }
      }
      if (tableKey || el.name || el.label) {
        return {
          type: 'table' as any,
          conceptId: tableKey,
          placeholder: tableName,
          code: tableKey,
          value: null
        }
      }
      return null
    }

    const controls: IControl[] = []
    for (const list of lists) {
      for (const el of list) {
        if (!el || typeof el !== 'object') continue

        // 遇到表格：不管里面的 tr/td，提取表格本身的名称和 key
        if (el.type === 'table') {
          const tableCtrl = parseTableControl(el)
          if (tableCtrl) {
            controls.push(tableCtrl)
          }
          continue
        }

        if (el.control && typeof el.control === 'object') {
          controls.push(el.control)
        } else if (el.type === 'control') {
          controls.push(el.control || el)
        } else if (Array.isArray(el.valueList)) {
          // 处理标题等顶层容器元素内的控件
          for (const subEl of el.valueList) {
            if (!subEl || typeof subEl !== 'object') continue
            if (subEl.type === 'table') {
              const tableCtrl = parseTableControl(subEl)
              if (tableCtrl) {
                controls.push(tableCtrl)
              }
              continue
            }
            if (subEl.control && typeof subEl.control === 'object') {
              controls.push(subEl.control)
            } else if (subEl.type === 'control') {
              controls.push(subEl.control || subEl)
            }
          }
        }
      }
    }

    return controls
  }

  /**
   * 获取当前画布中的所有表单/占位符控件列表
   * 若无画布对象或 RPC 不可用，自动通过 getTemplate 提取顶层控件
   */
  public async getControlList(): Promise<IControl[]> {
    if (this.editorRpc) {
      try {
        const list = await this.editorRpc.getControlList()
        if (Array.isArray(list) && list.length > 0) {
          return list.map(item => item?.control || item).filter(Boolean)
        }
      } catch (err) {
        console.warn('[EditorClient SDK] 从画布获取控件列表失败，尝试降级读取模板:', err)
      }
    }

    // 无画布对象或获取失败时：从 getTemplate 获取并提取
    if (this.options.getTemplate) {
      try {
        const template =
          typeof this.options.getTemplate === 'function'
            ? await this.options.getTemplate()
            : this.options.getTemplate
        return this.extractControlsFromTemplate(template)
      } catch (err) {
        console.error('[EditorClient SDK] 从 getTemplate 读取模板失败:', err)
      }
    }

    return []
  }

  /**
   * 检查宿主业务数据与画布/模板控件列表的字段对齐与假值情况
   * 支持手动传 template 和 data：
   * - 若显式传入，则基于传入的 template 与 data 筛选出 missingControls 与 falsyControls；
   * - 若缺省，则自动回退至 options.getTemplate / options.getData 获取；
   * - 若只传其中一个，另一个自动回退至 getTemplate 或 getData；
   * - 若最终仍缺少 template 或 data，则抛出明确的异常错误。
   */
  public async getMissingControlList(
    optionsOrTemplateOrData?: { template?: any; data?: any } | any,
    customData?: Record<string, any>
  ): Promise<IControlDataAuditResult> {
    let explicitTemplate: any = undefined
    let explicitData: any = undefined

    // 1. 参数解析与解构
    if (optionsOrTemplateOrData && typeof optionsOrTemplateOrData === 'object') {
      if ('template' in optionsOrTemplateOrData || 'data' in optionsOrTemplateOrData) {
        // 对象入参模式：{ template?: any, data?: any }
        explicitTemplate = optionsOrTemplateOrData.template
        explicitData = optionsOrTemplateOrData.data
      } else if (customData !== undefined) {
        // 双参模式：(template, data)
        explicitTemplate = optionsOrTemplateOrData
        explicitData = customData
      } else {
        // 单参模式：根据结构智能区分是 template 还是 data
        const isTemplateLike =
          Array.isArray(optionsOrTemplateOrData) ||
          optionsOrTemplateOrData.main !== undefined ||
          optionsOrTemplateOrData.header !== undefined ||
          optionsOrTemplateOrData.footer !== undefined ||
          (optionsOrTemplateOrData.data &&
            (optionsOrTemplateOrData.data.main !== undefined ||
              optionsOrTemplateOrData.data.header !== undefined))
        if (isTemplateLike) {
          explicitTemplate = optionsOrTemplateOrData
        } else if (Object.keys(optionsOrTemplateOrData).length > 0) {
          explicitData = optionsOrTemplateOrData
        }
      }
    } else if (customData !== undefined) {
      explicitData = customData
    }

    // 2. 解析与获取 controls（模板与控件列表）
    let controls: IControl[] | null = null

    if (explicitTemplate !== undefined && explicitTemplate !== null) {
      controls = this.extractControlsFromTemplate(explicitTemplate)
    } else if (this.options.getTemplate) {
      // 未显式传 template，去 options.getTemplate 中查找
      try {
        const t =
          typeof this.options.getTemplate === 'function'
            ? await this.options.getTemplate()
            : this.options.getTemplate
        if (t !== undefined && t !== null) {
          controls = this.extractControlsFromTemplate(t)
        }
      } catch (err) {
        console.error('[EditorClient SDK] getMissingControlList 从 getTemplate 获取模板失败:', err)
      }
    }

    // 若依然未获取到 controls，尝试降级读取画布或通过 getControlList 获取
    if (controls === null) {
      try {
        const list = await this.getControlList()
        if (Array.isArray(list) && (list.length > 0 || this.editorRpc)) {
          controls = list
        }
      } catch {
        // ignore
      }
    }

    if (controls === null) {
      throw new Error(
        '[EditorClient SDK] getMissingControlList 校验失败：缺少有效的 template 参数，且未配置或无法通过 getTemplate/画布 获取控件列表'
      )
    }

    // 3. 解析与获取 targetData（业务数据）
    let targetData: Record<string, any> | null = null
    let dataSourceFound = false

    if (explicitData !== undefined && explicitData !== null) {
      if (typeof explicitData === 'object' && !Array.isArray(explicitData)) {
        targetData = explicitData
        dataSourceFound = true
      }
    } else {
      // 未显式传 data，去 options.getData 中查找
      if (this.options.getData) {
        try {
          const d =
            typeof this.options.getData === 'function'
              ? await this.options.getData()
              : this.options.getData
          if (d && typeof d === 'object' && !Array.isArray(d)) {
            targetData = d
            dataSourceFound = true
            this.lastFilledData = d
          }
        } catch (err) {
          console.error('[EditorClient SDK] getMissingControlList 从 getData 获取数据失败:', err)
        }
      }
      // 若 getData 未配置或未获取到，降级尝试使用历史填充数据
      if (!dataSourceFound && this.lastFilledData) {
        targetData = this.lastFilledData
        dataSourceFound = true
      }
    }

    if (!dataSourceFound || targetData === null) {
      throw new Error(
        '[EditorClient SDK] getMissingControlList 校验失败：缺少有效的 data 参数，且未配置或无法通过 getData 获取业务数据'
      )
    }

    // 4. 筛选 missingControls 和 falsyControls
    const missingControls: IControl[] = []
    const falsyControls: IControl[] = []

    controls.forEach(ctrl => {
      const conceptId = ctrl.conceptId || (ctrl as any).fieldKey || ctrl.code
      if (!conceptId) return

      const hasKey = this.hasFieldInData(targetData, conceptId)
      if (!hasKey) {
        missingControls.push(ctrl)
        return
      }

      const val = this.getFieldValue(targetData, conceptId)
      if (this.isFalsyExceptZeroAndFalse(val)) {
        falsyControls.push(ctrl)
      }
    })

    return {
      missingControls,
      falsyControls,
      missControls: missingControls,
      falseControls: falsyControls
    }
  }

  /**
   * 判断值是否为除 0 和 false 以外的假值/空值
   */
  private isFalsyExceptZeroAndFalse(val: any): boolean {
    if (val === 0 || val === false) return false
    if (val === null || val === undefined || val === '') return true
    if (typeof val === 'number' && isNaN(val)) return true
    if (typeof val === 'string' && val.trim() === '') return true
    if (Array.isArray(val) && val.length === 0) return true
    return false
  }

  /**
   * 从数据对象中获取对应字段的值
   */
  private getFieldValue(data: any, path: string): any {
    if (!data || typeof data !== 'object' || !path) return undefined
    if (path in data) return data[path]
    const pathVal = getValueByPath(data, path)
    if (pathVal !== undefined) return pathVal
    if (path.includes('.')) {
      const underscoreKey = path.replace(/\./g, '_')
      if (underscoreKey in data) return data[underscoreKey]
      const leafKey = path.split('.').pop()!
      if (leafKey in data) return data[leafKey]
    }
    return undefined
  }

  /**
   * 检查数据对象中是否存在目标 key / 路径
   */
  private hasFieldInData(data: any, path: string): boolean {
    if (!data || typeof data !== 'object' || !path) return false

    if (path in data) {
      return true
    }

    const parts = path.split('.').filter(Boolean)
    if (parts.length > 1) {
      let curr = data
      let exists = true
      for (const p of parts) {
        if (curr && typeof curr === 'object' && p in curr) {
          curr = curr[p]
        } else {
          exists = false
          break
        }
      }
      if (exists) return true
    }

    if (path.includes('.')) {
      const underscoreKey = path.replace(/\./g, '_')
      if (underscoreKey in data) {
        return true
      }
      const leafKey = path.split('.').pop()!
      if (leafKey in data) {
        return true
      }
    }

    return false
  }

  /**
   * 触发编辑器导出 PDF
   */
  public async exportPdf(): Promise<void> {
    if (this.editorRpc) {
      await this.editorRpc.executeExportPdf()
    }
  }

  /**
   * 动态更新编辑器配置（如动态显示/隐藏顶部功能栏或底部状态栏）
   */
  public async setConfig(config: any): Promise<void> {
    if (this.editorRpc) {
      this.options.config = {
        ...this.options.config,
        ...config
      }
      await this.editorRpc.setCustomConfig(this.options.config)
    }
  }

  /**
   * 触发编辑器打印
   */
  public async print(): Promise<void> {
    if (this.editorRpc) {
      await this.editorRpc.executePrint()
    }
  }

  /**
   * 订阅编辑器事件
   */
  public on(event: string, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 取消订阅编辑器事件
   */
  public off(event: string, listener: EventListener): void {
    this.eventListeners.get(event)?.delete(listener)
  }

  /**
   * 销毁跨窗口 RPC 通信连接
   */
  public destroy(): void {
    this.connection?.destroy()
  }

  /**
   * 静态表格回显深度诊断工具
   */
  public static debugTable = debugTableEcho
}

// 自动挂载至宿主 window
if (typeof window !== 'undefined') {
  ;(window as any).debugTable = debugTableEcho
  ;(window as any).debugTableEcho = debugTableEcho
  ;(window as any).EditorClient = EditorClient
}
