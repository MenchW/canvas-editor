import { connect, WindowMessenger } from 'penpal'
import type Editor from '../editor'
import type { IBridgeOptions, IHostRpcMethods } from '../sdk/types'
import { getValueByPath, deepClone, getUUID, splitText } from '../editor/utils/index'
import { applyDeclaredSameMerge } from '../editor/utils/dataEngine'

/** 将 KV 对象结构化数据转换为 Canvas Editor 原生 executeSetControlValueList 填值数据 */
function toControlValueList(data: Record<string, any>, prefix = ''): any[] {
  if (!data || typeof data !== 'object') return []
  const result: any[] = []
  Object.keys(data).forEach(key => {
    const val = data[key]
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (val === null || val === undefined) {
      result.push({ conceptId: fullPath, value: '' })
    } else if (Array.isArray(val)) {
      // 数组型集合数据（List.Text / List.Radio / List.Checkbox / List.Image）直接原样下发，由原生 Control 体系处理
      result.push({ conceptId: fullPath, value: val })
    } else if (typeof val === 'object') {
      // 嵌套对象递归展平
      result.push(...toControlValueList(val, fullPath))
    } else {
      result.push({ conceptId: fullPath, value: String(val) })
    }
  })
  return result
}

// 记录克隆后重新分配 ID 并收集的文本控件值列表
const collectedValues: { id: string; value: any }[] = []

/** 递归展开循环明细表并填充子控件 */
function expandLoopTables(
  elementList: any[],
  businessData: any,
  parentContext: any = null,
  depth = 0
) {
  if (!Array.isArray(elementList) || depth > 20) return

  const walkTd = (tdList: any[], context: any) => {
    if (!Array.isArray(tdList)) return
    tdList.forEach((td: any) => {
      if (Array.isArray(td.value)) {
        expandLoopTables(td.value, businessData, context, depth + 1)
      }
    })
  }

  for (let i = 0; i < elementList.length; i++) {
    const el = elementList[i]
    if (el.type !== 'table' || !Array.isArray(el.trList)) continue

    const newTrList: any[] = []
    const trList = el.trList

    for (let r = 0; r < trList.length; r++) {
      const tr = trList[r]
      const loopConfig = tr.loopConfig

      if (loopConfig?.isLoopRow) {
        // 判断是否为外层大标题分组（如 tbody loop 带 groupHeader，且紧跟着子明细循环）
        const nextTr = trList[r + 1]
        const isGroupHeaderWithChild =
          loopConfig.isGroupHeader &&
          nextTr &&
          nextTr.loopConfig?.isLoopRow &&
          !nextTr.loopConfig.isGroupHeader

        if (isGroupHeaderWithChild) {
          // 复合嵌套分组：依次渲染每个 group 的大标题行 + 组内子明细行
          const datasetId = loopConfig.datasetId
          const listData = getValueByPath(parentContext || businessData, datasetId)
          const groups = Array.isArray(listData) && listData.length > 0 ? listData : [null]
          const detailTr = nextTr

          groups.forEach((groupItem: any) => {
            // 1. 克隆并填充大标题行
            const clonedHeaderTr = deepClone(tr)
            delete clonedHeaderTr.loopConfig
            clonedHeaderTr.id = getUUID()
            clonedHeaderTr.tdList.forEach((td: any) => {
              td.id = getUUID()
            })
            remapControlIdsAndCollect(clonedHeaderTr, groupItem)
            walkTd(clonedHeaderTr.tdList, groupItem)
            newTrList.push(clonedHeaderTr)

            // 2. 展开该 group 内的子明细行
            const subData =
              groupItem && typeof groupItem === 'object'
                ? groupItem.children ||
                  groupItem.items ||
                  groupItem.data ||
                  groupItem.tableData ||
                  (detailTr.loopConfig?.datasetId ? groupItem[detailTr.loopConfig.datasetId] : null)
                : null
            const subRows = Array.isArray(subData) && subData.length > 0 ? subData : [null]

            subRows.forEach((subItem: any) => {
              const clonedDetailTr = deepClone(detailTr)
              delete clonedDetailTr.loopConfig
              clonedDetailTr.id = getUUID()
              clonedDetailTr.tdList.forEach((td: any) => {
                td.id = getUUID()
              })
              remapControlIdsAndCollect(clonedDetailTr, subItem)
              walkTd(clonedDetailTr.tdList, subItem)
              newTrList.push(clonedDetailTr)
            })
          })

          r++ // 跳过已配对展开的明细行
        } else {
          const datasetId = loopConfig.datasetId
          const blockEnd = Math.max(
            r,
            loopConfig.endTrIndex !== undefined
              ? Math.min(loopConfig.endTrIndex, trList.length - 1)
              : r
          )
          const listData = getValueByPath(parentContext || businessData, datasetId)
          const dataRows = Array.isArray(listData) && listData.length > 0 ? listData : [null]

          dataRows.forEach(itemData => {
            for (let br = r; br <= blockEnd; br++) {
              const clonedTr = deepClone(trList[br])
              delete clonedTr.loopConfig
              clonedTr.id = getUUID()
              clonedTr.tdList.forEach((td: any) => {
                td.id = getUUID()
              })
              remapControlIdsAndCollect(clonedTr, itemData)
              walkTd(clonedTr.tdList, itemData)
              newTrList.push(clonedTr)
            }
          })

          r = blockEnd
        }
      } else {
        walkTd(tr.tdList, parentContext)
        newTrList.push(tr)
      }
    }

    const tableId = el.id || getUUID()
    el.id = tableId
    for (let t = 0; t < newTrList.length; t++) {
      const tr = newTrList[t]
      const trId = tr.id || getUUID()
      tr.id = trId
      for (let d = 0; d < tr.tdList.length; d++) {
        const td = tr.tdList[d]
        const tdId = td.id || getUUID()
        td.id = tdId
        if (Array.isArray(td.value)) {
          for (let v = 0; v < td.value.length; v++) {
            const valEl = td.value[v]
            valEl.tdId = tdId
            valEl.trId = trId
            valEl.tableId = tableId
          }
        }
      }
    }

    el.trList = newTrList
  }
}

/** 从 itemData 结构化数据中按 conceptId 安全提取字段值（支持多图数组、对象数组、[].url 等各种写法） */
function getItemValue(itemData: any, conceptId: string): any {
  if (!itemData || !conceptId) return undefined

  // 1. 直接按原始键名取值
  if (itemData[conceptId] !== undefined && itemData[conceptId] !== null) {
    return itemData[conceptId]
  }

  // 2. 将 [] 转换为通配符 [*] 后按路径取值
  const wildcardKey = conceptId.replace(/\[\]/g, '[*]')
  const wildcardVal = getValueByPath(itemData, wildcardKey)
  if (wildcardVal !== undefined && wildcardVal !== null) {
    if (!Array.isArray(wildcardVal) || wildcardVal.length > 0) {
      return wildcardVal
    }
  }

  // 3. 去除 [] 后的标准点号路径取值
  const cleanKey = conceptId.replace(/\[\]\./g, '.').replace(/\[\]/g, '')
  const cleanVal = getValueByPath(itemData, cleanKey)
  if (cleanVal !== undefined && cleanVal !== null) {
    if (!Array.isArray(cleanVal) || cleanVal.length > 0) {
      return cleanVal
    }
  }

  // 4. 针对一维数组场景
  const match = /^([^.[\]]+)(?:\[\]|\.\w+|\[\d+\])*/.exec(conceptId)
  if (match) {
    const mainProp = match[1]
    const rawVal = itemData[mainProp]
    if (rawVal !== undefined && rawVal !== null) {
      if (Array.isArray(rawVal)) {
        const subPropMatch = /(?:\.|\[\]\.)(\w+)$/.exec(conceptId)
        const subProp = subPropMatch ? subPropMatch[1] : ''
        if (subProp) {
          const extracted = rawVal
            .map((item: any) =>
              typeof item === 'object' && item !== null
                ? item[subProp] !== undefined
                  ? item[subProp]
                  : item.url || item.src || item.value
                : item
            )
            .filter((v: any) => v !== undefined && v !== null && v !== '')
          if (extracted.length > 0) return extracted
        }
        return rawVal
      }
      return rawVal
    }
  }

  return undefined
}

function evaluateWhenCondition(expr: string, itemData: any): boolean {
  if (!expr || typeof expr !== 'string') return true
  if (!itemData || typeof itemData !== 'object') return true
  try {
    const fn = new Function(
      'item',
      'data',
      `try { with(data || {}) { with(item || {}) { return Boolean(${expr}); } } } catch(e) { return false; }`
    )
    return fn(itemData, itemData)
  } catch {
    const match = expr.match(/([\w\.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)/)
    if (match) {
      const field = match[1].replace(/^(?:item|row)\./, '')
      const op = match[2]
      const targetVal = isNaN(Number(match[3].trim()))
        ? match[3].trim().replace(/^['"]|['"]$/g, '')
        : Number(match[3].trim())
      const actualVal = (itemData as any)?.[field]
      if (actualVal === undefined) return false
      switch (op) {
        case '>':
          return actualVal > targetVal
        case '<':
          return actualVal < targetVal
        case '>=':
          return actualVal >= targetVal
        case '<=':
          return actualVal <= targetVal
        case '==':
          return String(actualVal) === String(targetVal)
        case '!=':
          return String(actualVal) !== String(targetVal)
      }
    }
    return true
  }
}

function remapControlIdsAndCollect(tr: any, itemData: any) {
  const idMap = new Map<string, string>()

  tr.tdList.forEach((td: any) => {
    if (!Array.isArray(td.value)) return

    // 0. 根据 when 条件过滤当前单元格内不满足条件的元素
    if (itemData) {
      td.value = td.value.filter((el: any) => {
        const when = el.when || el.control?.when
        if (!when) return true
        return evaluateWhenCondition(when, itemData)
      })
    }

    // 1. 刷新 Remap 控件 ID，确保克隆出的每一行所有字符和控件节点都拥有独立的唯一 ID
    td.value.forEach((el: any) => {
      if (el.controlId || el.type === 'control' || el.control) {
        if (!el.controlId) {
          el.controlId = getUUID()
        } else {
          if (!idMap.has(el.controlId)) {
            idMap.set(el.controlId, getUUID())
          }
          el.controlId = idMap.get(el.controlId)!
        }
      }
    })

    // 2. 扫描并处理字段（支持单图/多图数组解包展开与文本直接回显）
    const processedControlIds = new Set<string>()

    for (let i = 0; i < td.value.length; i++) {
      const el = td.value[i]
      const control = el.control
      const conceptId = control?.conceptId
      const targetControlId = el.controlId

      if (!conceptId || !itemData || !targetControlId || processedControlIds.has(targetControlId)) {
        continue
      }

      const val = getItemValue(itemData, conceptId)

      // 判断是否为图片字段
      const isImgField =
        control?.type === 'image' ||
        (control as any)?.type === 'image' ||
        conceptId.toLowerCase().includes('img') ||
        conceptId.toLowerCase().includes('image') ||
        conceptId.toLowerCase().includes('photo') ||
        conceptId.toLowerCase().includes('pic') ||
        (Array.isArray(val) &&
          val.some(
            (it: any) =>
              (typeof it === 'string' &&
                (it.startsWith('http') || it.startsWith('data:image'))) ||
              it?.url ||
              it?.src
          ))

      const matchingIndices: number[] = []
      for (let k = 0; k < td.value.length; k++) {
        if (td.value[k].controlId === targetControlId) matchingIndices.push(k)
      }
      if (matchingIndices.length === 0) continue

      const baseNode = td.value[matchingIndices[0]]

      if (isImgField) {
        // 多图 / 单图列表渲染
        const rawUrls =
          val !== undefined && val !== null && val !== ''
            ? Array.isArray(val)
              ? val
              : [val]
            : []
        const validImages = rawUrls
          .map((v: any) => (typeof v === 'object' ? v.url || v.src || String(v) : String(v)))
          .filter((v: string) => v && (v.startsWith('http') || v.startsWith('data:image')))

        const newNodes: any[] = []
        if (validImages.length > 0) {
          validImages.forEach((imgUrl: string, idx: number) => {
            if (idx > 0) newNodes.push({ value: ' ' })
            newNodes.push({
              type: 'image',
              value: imgUrl,
              width: control?.width || 42,
              height: control?.height || 42
            })
          })
        } else {
          newNodes.push({ value: '-' })
        }

        const firstIdx = matchingIndices[0]
        for (let m = matchingIndices.length - 1; m >= 0; m--) {
          td.value.splice(matchingIndices[m], 1)
        }
        td.value.splice(firstIdx, 0, ...newNodes)
        i = firstIdx + newNodes.length - 1
      } else {
        // 普通文本 / 数值字段直接展开为字符流
        const strVal = val !== undefined && val !== null ? String(val) : ''
        const newNodes =
          strVal.length > 0
            ? splitText(strVal).map((ch: string) => ({
                ...baseNode,
                value: ch,
                type: undefined,
                control: undefined,
                controlId: undefined,
                controlComponent: undefined
              }))
            : [{ ...baseNode, value: '', type: undefined, control: undefined, controlId: undefined }]

        const firstIdx = matchingIndices[0]
        for (let m = matchingIndices.length - 1; m >= 0; m--) {
          td.value.splice(matchingIndices[m], 1)
        }
        td.value.splice(firstIdx, 0, ...newNodes)
        i = firstIdx + newNodes.length - 1
      }
    }
  })
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

        // 3. 暂存业务数据
        if (payload.businessData) {
          this.lastBusinessData = payload.businessData
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
        const originalElementList = (
          this.instance.command as any
        ).getOriginalElementList()
        collectedValues.length = 0

        // 1. 表格循环行展开（保留控件结构与 Remap UUID，支持单元格多图）
        expandLoopTables(originalElementList, data)

        // 2. 批量向所有控件（文本、单选、多选、多图等）填充值并由 Control 体系多态展开
        const rootValues = toControlValueList(data)
        const uniqueCollected =
          collectedValues.length > 0
            ? Array.from(
                new Map(
                  collectedValues.map(item => [item.id, item.value])
                ).entries()
              ).map(([id, value]) => ({ id, value }))
            : []

        const allValues = [...rootValues, ...uniqueCollected]
        if (allValues.length > 0) {
          this.instance.command.executeSetControlValueList(allValues)
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
      }

      this.instance.command.executeForceUpdate()
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
