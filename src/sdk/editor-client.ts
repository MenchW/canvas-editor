/**
 * @file 宿主客户端 SDK 模块
 * @version 1.0.1
 * @author menchw
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

export { toast, EditorMode, CanvasDataTransform }
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
   * 从宿主 Providers 并发拉取数据并下发给编辑器渲染
   */
  private async fetchAndRender(): Promise<void> {
    if (!this.editorRpc) return
    try {
      const { getTemplate, getData, getComponents } = this.options
      if (!getTemplate) {
        console.warn('[EditorClient SDK] getTemplate 配置空')
      }

      if (!getData) {
        console.warn('[EditorClient SDK] getData 配置空')
      }

      if (!getComponents) {
        console.warn('[EditorClient SDK] getComponents 配置空')
      }
      console.log(getData)

      const [template, businessData, componentList] = await Promise.all([
        typeof getTemplate === 'function' ? getTemplate() : getTemplate,
        typeof getData === 'function' ? getData() : getData,
        getComponents
          ? typeof getComponents === 'function'
            ? getComponents()
            : getComponents
          : undefined
      ])

      console.log('[EditorClient SDK] 渲染参数', {
        template,
        data: businessData,
        componentList
      })

      if (
        businessData &&
        typeof businessData === 'object' &&
        !Array.isArray(businessData)
      ) {
        this.lastFilledData = businessData
      }

      await this.editorRpc.render({
        template,
        businessData: businessData || {},
        ...(componentList ? { componentList } : {})
      })
    } catch (err: any) {
      const msg = err || err.msg || err.message || '宿主数据拉取失败，请重试'
      await this.editorRpc?.setError(msg || '宿主数据拉取失败，请重试')
      throw err
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
   * 获取当前画布中的所有表单/占位符控件列表
   */
  public async getControlList(): Promise<IControl[]> {
    if (!this.editorRpc) return []
    const list = await this.editorRpc.getControlList()
    if (!Array.isArray(list)) return []
    return list.map(item => item?.control || item).filter(Boolean)
  }

  /**
   * 检查宿主业务数据与画布控件列表的字段对齐与假值情况
   */
  public async getMissingControlList(
    data?: Record<string, any>
  ): Promise<IControlDataAuditResult> {
    const controls = await this.getControlList()
    if (!controls || controls.length === 0) {
      return { missingControls: [], falsyControls: [] }
    }

    const targetData = data || this.lastFilledData

    if (
      !targetData ||
      typeof targetData !== 'object' ||
      Object.keys(targetData).length === 0
    ) {
      return { missingControls: [], falsyControls: [] }
    }

    const missingControls: IControl[] = []
    const falsyControls: IControl[] = []

    controls.forEach(ctrl => {
      const conceptId = ctrl.conceptId || ctrl.code
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
      falsyControls
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
}
