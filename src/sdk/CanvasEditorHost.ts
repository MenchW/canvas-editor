import { connect, WindowMessenger } from 'penpal'
import { EditorMode } from '../editor/dataset/enum/Editor'
import type {
  ICanvasEditorHost,
  ICanvasEditorHostOptions,
  IEditorRpcMethods,
  IControl
} from './types'

import { CanvasDataTransforms } from './transforms'

export { EditorMode, CanvasDataTransforms }
export type {
  ICanvasEditorHost,
  ICanvasEditorHostOptions,
  IFeatureConfig,
  TEditorMode,
  IControl
} from './types'

type EventListener = (...args: any[]) => void

/**
 * Canvas Editor 宿主 SDK 类
 * 用于在父页面嵌入编辑器 iframe 并建立跨窗口通信
 */
export class CanvasEditorHost implements ICanvasEditorHost {
  /** 快捷数据转换适配工具集 */
  public static transforms = CanvasDataTransforms

  private iframeEl: HTMLIFrameElement | null = null
  private editorRpc: IEditorRpcMethods | null = null
  private connection: any = null
  private options: ICanvasEditorHostOptions
  private eventListeners: Map<string, Set<EventListener>> = new Map()

  /**
   * 构造函数
   * @param options 初始化配置对象，包含 iframe 选择器、数据 Providers 和 Hook 回调
   */
  constructor(options: ICanvasEditorHostOptions) {
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
    if (!this.iframeEl) {
      console.error('[CanvasEditorHost SDK] 未找到指定的 iframe 节点')
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
          await this.options.onSave?.(documentJson)
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
      console.error('[CanvasEditorHost SDK] 与 Editor 建立通信连接失败:', err)
    }
  }

  /**
   * 从宿主 Providers (getTemplate, getData, getComponents) 并发拉取数据并下发给编辑器渲染
   */
  private async fetchAndRender(): Promise<void> {
    if (!this.editorRpc) return
    try {
      const { getTemplate, getData, getComponents } = this.options
      const [template, businessData, componentList] = await Promise.all([
        typeof getTemplate === 'function' ? getTemplate() : getTemplate,
        typeof getData === 'function' ? getData() : getData,
        getComponents
          ? typeof getComponents === 'function'
            ? getComponents()
            : getComponents
          : undefined
      ])

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
   * @param event 事件名称
   * @param args 事件回调参数
   */
  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach(fn => fn(...args))
  }

  // ============================================================================
  // 公开 API 方法
  // ============================================================================

  /**
   * 获取当前编辑器的全文数据 JSON（包含 value 与 options）
   * @returns 编辑器数据对象，若连接未就绪则返回 null
   */
  public async getValue(): Promise<{ value: any; options: any } | null> {
    return this.editorRpc ? await this.editorRpc.getValue() : null
  }

  /**
   * 批量填充表单/占位符控件数据
   * @param data 可为键值对对象、结构化对象或 [{ conceptId, value }] 数组，缺省时自动调用 getData() 获取
   */
  public async setControlValueList(data?: Record<string, any> | any[]): Promise<void> {
    if (!this.editorRpc) return
    let targetData = data
    if (!targetData && this.options.getData) {
      targetData =
        typeof this.options.getData === 'function'
          ? await this.options.getData()
          : this.options.getData
    }
    await this.editorRpc.setControlValueList(targetData)
  }

  /**
   * 获取当前画布中的所有表单/占位符控件列表（提取核心 control 属性配置结构）
   * @returns 控件对象列表
   */
  public async getControlList(): Promise<IControl[]> {
    if (!this.editorRpc) return []
    const list = await this.editorRpc.getControlList()
    if (!Array.isArray(list)) return []
    return list.map(item => item?.control || item).filter(Boolean)
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
   * @param event 事件名称（如 contentChange, modeChange, export 等）
   * @param listener 事件回调函数
   */
  public on(event: string, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 取消订阅编辑器事件
   * @param event 事件名称
   * @param listener 取消绑定的回调函数
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
