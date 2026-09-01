/**
 * @file 表格设计态与数据回显深度调试诊断工具
 * @description 用于在设计态（如 component-management）分析表格 HTML 与业务 JSON 数据的匹配情况，
 * 准确定位为什么回显不上、别名不匹配、路径错误、空值等问题。
 */

import { parseTableHtml } from './index'
import { expandLoopTables } from '../bridge/editorBridge'
import { deepClone, getValueByPath } from '../editor/utils'

export interface ITableDebugFieldAudit {
  location: string
  rawPlaceholder: string
  fieldKey: string
  alias: string
  resolvedValue: any
  status: 'MATCHED' | 'EMPTY' | 'NOT_FOUND'
  advice?: string
}

export interface ITableDebugLoopAudit {
  type: 'tbody' | 'tr' | 'inner'
  alias: string
  sourcePath: string
  dataFound: boolean
  matchedDataLength: number
}

export interface ITableDebugResult {
  success: boolean
  originalRows: number
  expandedRows: number
  declaredLoops: ITableDebugLoopAudit[]
  fieldsAudit: ITableDebugFieldAudit[]
  warnings: string[]
  expandedTableElement: any
}

/**
 * 提取文本中所有的双花括号占位符 {{ xxx }}
 */
function extractPlaceholders(text: string): string[] {
  if (!text) return []
  const matches = text.match(/\{\{\s*([\w\.\-]+)\s*\}\}/g) || []
  return matches.map(m => m.replace(/^\{\{\s*|\s*\}\}$/g, ''))
}

/**
 * 诊断表格 HTML 与业务数据的回显匹配情况
 * @param tableHtmlOrElement 表格 HTML 字符串 或已解析的 Table IElement
 * @param businessData 宿主业务数据 JSON (可选，不传时自动尝试读取全局 Mock 数据)
 * @param options 配置项 (支持 renderToCanvas: true 直接渲染至当前画布)
 */
export function debugTableEcho(
  tableHtmlOrElement: string | any,
  businessData?: Record<string, any>,
  options: { verbose?: boolean; logToConsole?: boolean; renderToCanvas?: boolean } = {}
): ITableDebugResult {
  const { verbose = true, logToConsole = true, renderToCanvas = false } = options
  const warnings: string[] = []
  const declaredLoops: ITableDebugLoopAudit[] = []
  const fieldsAudit: ITableDebugFieldAudit[] = []

  // 若未传入 businessData，尝试从全局 window.mockFetchBusinessDataApi 或 window.CE_LAST_DATA 获取
  let effectiveData = businessData
  if (!effectiveData || Object.keys(effectiveData).length === 0) {
    if (typeof window !== 'undefined') {
      const g = window as any
      if (g.mockFetchBusinessDataApi) {
        try {
          const res = g.mockFetchBusinessDataApi()
          effectiveData = typeof res?.then === 'function' ? g.DEFAULT_COMPONENT_DATA || {} : res
        } catch {
          effectiveData = g.DEFAULT_COMPONENT_DATA || {}
        }
      }
    }
  }
  effectiveData = effectiveData || {}

  // 1. 规范化表格元素
  let tableEl: any = null
  if (typeof tableHtmlOrElement === 'string') {
    try {
      tableEl = parseTableHtml(tableHtmlOrElement)
    } catch (e: any) {
      warnings.push(`HTML 表格解析失败: ${e.message}`)
      if (logToConsole) {
        console.error('[表格调试] HTML 解析异常:', e)
      }
      return {
        success: false,
        originalRows: 0,
        expandedRows: 0,
        declaredLoops: [],
        fieldsAudit: [],
        warnings,
        expandedTableElement: null
      }
    }
  } else if (tableHtmlOrElement && typeof tableHtmlOrElement === 'object') {
    tableEl = deepClone(tableHtmlOrElement)
  }

  if (!tableEl || !Array.isArray(tableEl.trList)) {
    warnings.push('未检测到有效的表格结构 (trList 缺失，请检查 <table> 标签是否闭合)')
    return {
      success: false,
      originalRows: 0,
      expandedRows: 0,
      declaredLoops: [],
      fieldsAudit: [],
      warnings,
      expandedTableElement: null
    }
  }

  const originalRows = tableEl.trList.length

  // 2. 静态分析循环声明与占位符
  tableEl.trList.forEach((tr: any, rIdx: number) => {
    if (tr.loopConfig) {
      const { datasetId, itemAlias = 'item', isTbodyGroup, isDetailRow } = tr.loopConfig
      const loopType = isTbodyGroup ? 'tbody' : isDetailRow ? 'tr' : 'tr'
      
      // 检查数据源中是否存在该 datasetId
      let dataRows = getValueByPath(effectiveData, datasetId)
      if (!dataRows && effectiveData && typeof effectiveData === 'object') {
        dataRows = effectiveData[datasetId] || effectiveData.data || effectiveData.list || effectiveData.items
      }
      const isArray = Array.isArray(dataRows)
      const dataLen = isArray ? dataRows.length : 0

      declaredLoops.push({
        type: loopType as any,
        alias: itemAlias,
        sourcePath: datasetId,
        dataFound: isArray,
        matchedDataLength: dataLen
      })

      if (!isArray) {
        const availableKeys = Object.keys(effectiveData || {}).join(', ')
        warnings.push(
          `第 ${rIdx + 1} 行声明了循环路径 [${datasetId}]，但在数据源中未找到对应数组！(当前传入的数据顶层字段包含: ${availableKeys || '空数据'})`
        )
      }
    }

    // 检查单元格内占位符
    tr.tdList?.forEach((td: any, cIdx: number) => {
      const cellText = td.value?.map((v: any) => v.value || '').join('') || ''
      const placeholders = extractPlaceholders(cellText)

      td.value?.forEach((el: any) => {
        if (el.innerLoop) {
          const innerDataset = el.innerLoop.datasetId
          const innerAlias = el.innerLoop.itemAlias || 'item'
          declaredLoops.push({
            type: 'inner',
            alias: innerAlias,
            sourcePath: innerDataset,
            dataFound: true,
            matchedDataLength: 0
          })
        }
      })

      placeholders.forEach(ph => {
        const parts = ph.split('.')
        const alias = parts[0]
        const fieldKey = parts.slice(1).join('.') || ph

        fieldsAudit.push({
          location: `第 ${rIdx + 1} 行，第 ${cIdx + 1} 列`,
          rawPlaceholder: `{{ ${ph} }}`,
          fieldKey,
          alias,
          resolvedValue: undefined,
          status: 'NOT_FOUND'
        })
      })
    })
  })

  // 3. 动态模拟回显展开
  const cloneList = [deepClone(tableEl)]
  try {
    expandLoopTables(cloneList, effectiveData)
  } catch (e: any) {
    warnings.push(`表格展开回显执行报错: ${e.message}`)
  }

  const expandedTable = cloneList[0]
  const expandedRows = expandedTable?.trList?.length || 0

  // 4. 分析展开后的实际回显取值
  let matchedCount = 0
  fieldsAudit.forEach(auditItem => {
    // 在展开后的表格中查找是否已被赋值
    let foundValue: any = undefined
    let isFound = false

    expandedTable?.trList?.forEach((tr: any) => {
      tr.tdList?.forEach((td: any) => {
        td.value?.forEach((node: any) => {
          if (node.control?.conceptId === auditItem.fieldKey) {
            const ctrlVal = node.control?.value
            if (ctrlVal !== null && ctrlVal !== undefined && ctrlVal !== '') {
              foundValue = ctrlVal
              isFound = true
            }
          }
        })
      })
    })

    if (isFound) {
      auditItem.resolvedValue = typeof foundValue === 'object' ? JSON.stringify(foundValue) : foundValue
      auditItem.status = 'MATCHED'
      matchedCount++
    } else {
      auditItem.status = 'NOT_FOUND'
      auditItem.advice = `未匹配到有效值。排查建议：1. 检查别名 [${auditItem.alias}] 是否与 loop="item in list" 的 item 一致；2. 检查数据对象中是否存在属性 [${auditItem.fieldKey}]。`
    }
  })

  const success = warnings.length === 0 && (fieldsAudit.length === 0 || matchedCount > 0)

  // 5. 控制台高亮输出
  if (logToConsole) {
    const titleStyle = success
      ? 'background:#52c41a;color:#fff;font-weight:bold;padding:4px 10px;border-radius:4px;font-size:13px;'
      : 'background:#f5222d;color:#fff;font-weight:bold;padding:4px 10px;border-radius:4px;font-size:13px;'

    console.group(
      `%c[表格回显深度诊断报告] ${success ? '✔ 回显成功' : '✖ 发现潜在异常'} (原模板 ${originalRows} 行 -> 展开后 ${expandedRows} 行)`,
      titleStyle
    )

    if (warnings.length > 0) {
      console.group('%c⚠ 告警与诊断建议 (关键排查项)', 'color:#fa8c16;font-weight:bold;font-size:12px;')
      warnings.forEach(w => console.warn('• ' + w))
      console.groupEnd()
    }

    if (declaredLoops.length > 0) {
      console.group('%c🔄 循环层级与数据源映射', 'color:#1890ff;font-weight:bold;font-size:12px;')
      console.table(declaredLoops)
      console.groupEnd()
    }

    if (fieldsAudit.length > 0) {
      console.group('%c📋 占位符字段匹配明细表', 'color:#722ed1;font-weight:bold;font-size:12px;')
      console.table(fieldsAudit)
      console.groupEnd()
    }

    if (verbose) {
      console.log('📦 模拟展开后的 Table 元素结构:', expandedTable)
      console.log('📥 传入匹配的 Business Data 数据源:', effectiveData)
    }

    console.groupEnd()
  }

  // 6. 可选：直接插入当前画布进行真实渲染
  if (renderToCanvas && typeof window !== 'undefined') {
    const g = window as any
    const editor = g.editor || g._editor || g.canvasEditor || g.instance
    if (editor?.command?.executeInsertElementList) {
      editor.command.executeInsertElementList([deepClone(expandedTable)])
      console.log('%c[表格调试] 已成功将回显后的表格插入当前编辑器画布！', 'color:#52c41a;font-weight:bold;')
    }
  }

  return {
    success,
    originalRows,
    expandedRows,
    declaredLoops,
    fieldsAudit,
    warnings,
    expandedTableElement: expandedTable
  }
}

/**
 * 便捷调试别名（支持 window.debugTable 与 window.debugTableEcho）
 */
export const debugTable = debugTableEcho

// 自动挂载至 window，方便在浏览器控制台 F12 随时调用
if (typeof window !== 'undefined') {
  ;(window as any).debugTable = debugTableEcho
  ;(window as any).debugTableEcho = debugTableEcho
}
