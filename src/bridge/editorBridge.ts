import { connect, WindowMessenger } from 'penpal'
import type Editor from '../editor'
import type { IBridgeOptions, IHostRpcMethods } from '../sdk/types'
import {
  applyDeclaredSameMerge,
  renderCompositeDetailTrs,
  isImageField,
  isImageValue,
  isImageConceptName,
  cloneTrTemplate,
  expandLoopTables,
  remapControlIdsAndCollect,
  toControlValueList
} from '../editor/utils/dataEngine'

export {
  applyDeclaredSameMerge,
  renderCompositeDetailTrs,
  isImageField,
  isImageValue,
  isImageConceptName,
  cloneTrTemplate,
  expandLoopTables,
  remapControlIdsAndCollect,
  toControlValueList
}

/**
 * ============================================================================
 * 🌉 EditorBridge — 运行在 Canvas Editor (iframe 内部)
 * 负责接收外部宿主指令、执行画布渲染，并向宿主反向上报事件与 Hook 回调
 * ============================================================================
 */
export class EditorBridge {
  private instance: Editor
  private hostRpc: IHostRpcMethods | null = null
  private currentConfig: any = {}
  /** 宿主下发的业务数据(模式切换回显时复用) */
  private lastBusinessData: any = null

  constructor(options: IBridgeOptions) {
    this.instance = options.instance
    this.initParentConnection(options)
  }

  /**
   * 是否运行在 iframe 内部
   */
  public get isEmbedded(): boolean {
    return window.parent !== window
  }

  /**
   * 设置加载与错误遮罩 UI 状态
   */
  public setLoading(
    state: 'loading' | 'success' | 'error' | boolean,
    message?: string
  ) {
    const loadingEl = document.querySelector<HTMLDivElement>('#editor-loading')
    if (!loadingEl) return
    const spinnerBox = document.querySelector<HTMLDivElement>(
      '#loading-box-spinner'
    )
    const errorBox =
      document.querySelector<HTMLDivElement>('#loading-box-error')
    const textEl = document.querySelector<HTMLDivElement>('#loading-text')
    const errorMsgEl =
      document.querySelector<HTMLDivElement>('#loading-error-msg')

    if (state === true || state === 'loading') {
      if (textEl && message) textEl.innerText = message
      errorBox?.classList.add('hidden')
      spinnerBox?.classList.remove('hidden')
      loadingEl.classList.remove('hidden')
    } else if (state === false || state === 'success') {
      loadingEl.classList.add('hidden')
    } else if (state === 'error') {
      if (errorMsgEl && message) errorMsgEl.innerText = message
      spinnerBox?.classList.add('hidden')
      errorBox?.classList.remove('hidden')
      loadingEl.classList.remove('hidden')
    }
  }

  /**
   * 建立与父窗口宿主的跨窗 RPC 连接
   */
  private async initParentConnection(options: IBridgeOptions) {
    if (window.parent === window) {
      // 非 iframe 独立运行时，直接隐藏 loading 遮罩，无需等待宿主通信
      this.setLoading('success')
      return
    }

    try {
      const connection = connect<IHostRpcMethods>({
        messenger: new WindowMessenger({
          remoteWindow: window.parent,
          allowedOrigins: ['*']
        }),
        // 暴露给父窗口的方法
        methods: {
          /** 宿主下发最新配置 */
          setCustomConfig: (config: any) => {
            this.currentConfig = { ...this.currentConfig, ...config }
            options.setCustomConfig?.(config)
          },
          /** 宿主设置遮罩错误状态 */
          setError: (msg?: string) =>
            this.setLoading('error', msg || '加载失败，请重试'),
          /** 宿主批量填充表单控件 */
          setControlValueList: (payload: any) =>
            this.setControlValueList(payload),
          /** 宿主驱动渲染 */
          render: (payload: any) => this.executeRenderPayload(payload, options),
          /** 宿主更新右侧控件列表 */
          updateComponents: (components: any[]) =>
            options.updateComponents?.(components),
          executePrint: () => this.instance.command.executePrint(),
          executeExportPdf: () => this.instance.command.executeExportPdf(),
          /** 宿主获取编辑器全文 JSON */
          getValue: () => this.instance.command.getValue(),
          /** 宿主获取所有控件列表 */
          getControlList: () => this.instance.command.getControlList()
        }
      })

      // 获得父窗口 RPC 代理对象
      this.hostRpc = await connection.promise
      console.log('[EditorBridge] 跨窗 RPC 通信信道建立成功')
    } catch (e) {
      console.warn('[EditorBridge] 父窗口通信握手跳过:', e)
    }
  }

  /**
   * 宿主调用 render() 时的执行器：
   * 1. 渲染模板文档结构
   * 2. 暂存结构化业务数据(不自动回显,由宿主点击"回显数据"按钮经 fillData 触发)
   * 3. 更新右侧组件面板
   * 4. 重新应用宿主配置（确保 mode 等不被模板覆盖）
   */
  private executeRenderPayload(payload: any, options: IBridgeOptions) {
    this.setLoading('loading', '文档数据加载中...')
    try {
      if (payload) {
        const template = payload.template || payload



        // 1. 设置排版 options
        if (template.options && typeof template.options === 'object') {
          this.instance.command.executeUpdateOptions(template.options)
        }

        // 2. 设置文档正文 data
        const data =
          template.data ||
          (Array.isArray(template) ? { main: template } : template)
        if (data) {
          this.instance.command.executeSetValue(data)
        }

        // 3. 填充并回显业务数据 (若下发了非空 businessData 对象则立即驱动回显)
        if (
          payload.businessData &&
          typeof payload.businessData === 'object' &&
          Object.keys(payload.businessData).length > 0
        ) {
          this.lastBusinessData = payload.businessData
          this.setControlValueList(payload.businessData)
        }

        // 4. 更新右侧组件列表
        if (payload.componentList && options.updateComponents) {
          options.updateComponents(payload.componentList)
        }

        if (this.currentConfig && options.setCustomConfig) {
          options.setCustomConfig(this.currentConfig)
        }

        this.instance.command.executeForceUpdate()
        this.instance.command.executeRecoveryHistory()
      }

      requestAnimationFrame(() => {
        setTimeout(() => this.setLoading('success'), 300)
      })
    } catch (err: any) {
      console.error('[EditorBridge] 渲染文档失败:', err)
      this.setLoading('error', err?.message || '文档渲染失败')
    }
  }

  /**
   * 触发宿主 onSave 保存回调
   * @param documentJson 编辑器当前文档全文数据对象
   */
  public async notifySave(documentJson: any): Promise<boolean> {
    if (this.hostRpc?.onSave) {
      await this.hostRpc.onSave(documentJson)
      return true
    }
    return false
  }

  /**
   * 判断宿主系统是否监听了保存事件
   */
  public hasSaveListener(): boolean {
    return Boolean(this.hostRpc?.onSave)
  }

  /**
   * 触发宿主 onExport 导出回调
   * @param type 导出动作类型（如 pdf / docx / image）
   */
  public async notifyExport(type: string) {
    if (this.hostRpc?.onExport) {
      await this.hostRpc.onExport(type)
    }
  }

  /**
   * 触发宿主 onUploadImage 图片/电子签名上传 Hook
   * @param base64 图片或电子签名的 Base64 数据
   * @returns 宿主上传 OSS 后返回的在线 https 图片 URL（失败时降级返回原始 Base64）
   */
  public async notifyUploadImage(base64: string): Promise<string> {
    if (this.hostRpc?.onUploadImage) {
      try {
        const imageUrl = await this.hostRpc.onUploadImage(base64)
        if (imageUrl && typeof imageUrl === 'string') return imageUrl
      } catch (err) {
        console.error('[EditorBridge] 唤醒宿主图片上传 Hook 失败:', err)
      }
    }
    return base64
  }

  /**
   * 触发宿主 onModeChange 模式变更回调
   * @param mode 新切换的模式字符串
   */
  public async notifyModeChange(mode: string) {
    if (this.hostRpc?.onModeChange) {
      await this.hostRpc.onModeChange(mode)
    }
  }

  /**
   * 触发宿主 onPrint 打印 Hook 通知
   * @returns 宿主是否允许调起原生打印面板（默认 true）
   */
  public async notifyPrint(): Promise<boolean> {
    if (this.hostRpc?.onPrint) {
      try {
        const res = await this.hostRpc.onPrint()
        if (res === false) return false
      } catch (err) {
        console.error('[EditorBridge] 唤醒宿主 onPrint 失败:', err)
      }
    }
    return true
  }

  /**
   * 上报编辑器通用自定义事件给宿主
   * @param eventName 事件名称（如 contentChange, controlChange 等）
   * @param data 事件数据对象
   */
  public notifyEvent(eventName: string, data?: any) {
    if (this.hostRpc?.onEvent) {
      this.hostRpc.onEvent(eventName, data)
    }
  }

  /**
   * 宿主批量设置占位符/表单控件数据 API
   * 直接作用于当前画布上的控件，支持明细表格展开与键值/路径匹配填值
   */
  public setControlValueList(payload?: any) {
    try {
      const data = payload || this.lastBusinessData
      if (!data) {
        console.warn('[EditorBridge] 暂无可设置的控件数据')
        return
      }
      if (payload && typeof payload === 'object') {
        this.lastBusinessData = payload
      }

      if (Array.isArray(data)) {
        // 直接下发 ID/conceptId 键值对数组
        this.instance.command.executeSetControlValueList(data)
      } else {
        // 1. 基于当前画布上的 ElementList 动态展开循环表格
        const originalElementList = (
          this.instance.command as any
        ).getOriginalElementList()
        const isDesignMode = Boolean(
          (this.instance.command as any).isDesignMode?.()
        )
        expandLoopTables(originalElementList, data, null, 0, isDesignMode)

        // 2. 批量向所有控件（文本、单选、多选、多图等）填充值并由 Control 体系多态展开
        const rootValues = toControlValueList(data)
        if (rootValues.length > 0) {
          this.instance.command.executeSetControlValueList(rootValues)
        }

        // 5. 声明式相邻相同数据垂直合并 (merge-same)
        const walkMerge = (list: any[]) => {
          if (!Array.isArray(list)) return
          list.forEach(item => {
            if (item.type === 'table') {
              applyDeclaredSameMerge(item)
            }
            if (item.valueList) walkMerge(item.valueList)
            if (item.trList) {
              item.trList.forEach((tr: any) => {
                if (tr.tdList) {
                  tr.tdList.forEach((td: any) => {
                    if (td.value) walkMerge(td.value)
                  })
                }
              })
            }
          })
        }
        walkMerge(originalElementList)

        this.instance.command.executeForceUpdate()
      }
    } catch (err: any) {
      console.error('[EditorBridge] 设置控件数据失败:', err)
    }
  }

  /**
   * 触发宿主 onRetry 重试重新请求数据回调
   */
  public async notifyRetry() {
    if (this.hostRpc?.onRetry) {
      await this.hostRpc.onRetry()
    }
  }
}
