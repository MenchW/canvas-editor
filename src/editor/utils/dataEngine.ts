import { ElementType } from '../dataset/enum/Element'
import { ControlType } from '../dataset/enum/Control'
import { IElement } from '../interface/Element'
import { ITd } from '../interface/table/Td'
import { ITr } from '../interface/table/Tr'
import { splitText, getValueByPath } from './index'

/** 标准化将图片列表/数组展开为 IElement 序列 */
function formatListImageElements(
  images: any[],
  options?: { width?: number; height?: number; layout?: string; gridCols?: number }
): IElement[] {
  const result: IElement[] = []
  if (!Array.isArray(images)) return result
  const imgWidth = options?.width || 42
  const imgHeight = options?.height || 42
  const layout = options?.layout || 'horizontal'
  const gridCols = Number(options?.gridCols) || 2

  images.forEach((img: any, idx: number) => {
    const url = typeof img === 'string' ? img : img?.url || img?.src || ''
    if (url) {
      if (idx > 0 && layout === 'horizontal') {
        result.push({ value: ' ' })
      }
      result.push({
        type: ElementType.IMAGE,
        value: url,
        width: imgWidth,
        height: imgHeight
      })
      const shouldWrap =
        (layout === 'vertical' && idx < images.length - 1) ||
        (layout === 'grid' && (idx + 1) % gridCols === 0 && idx < images.length - 1)
      if (shouldWrap) {
        result.push({ value: '\n' })
      }
    }
  })
  return result
}

/** 选项组数据驱动辅助 */
function renderDynamicOptions(
  controlElement: IElement,
  dynamicData: any
): void {
  if (!controlElement.control) return

  const ctrl = controlElement.control
  const valueSets: Array<{ value: string; code: string }> = []
  const selectedCodes: string[] = []
  const isVertical = ctrl.layout === 'vertical' || ctrl.isVertical === true
  const isGrid = ctrl.layout === 'grid'
  const gridCols = Number(ctrl.gridCols) || 2

  if (Array.isArray(dynamicData)) {
    dynamicData.forEach((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        let label = item.label || item.text || item.name || item.value || `选项${idx + 1}`
        const code = String(item.value ?? item.code ?? item.id ?? `opt_${idx + 1}`)
        const shouldWrap =
          (isVertical && idx < dynamicData.length - 1) ||
          (isGrid && (idx + 1) % gridCols === 0 && idx < dynamicData.length - 1)
        if (shouldWrap && !label.endsWith('\n')) {
          label += '\n'
        }
        valueSets.push({ value: label, code })
        if (item.checked === true || item.selected === true) {
          selectedCodes.push(code)
        }
      } else {
        let label = String(item)
        const code = `opt_${idx + 1}`
        const shouldWrap =
          (isVertical && idx < dynamicData.length - 1) ||
          (isGrid && (idx + 1) % gridCols === 0 && idx < dynamicData.length - 1)
        if (shouldWrap && !label.endsWith('\n')) {
          label += '\n'
        }
        valueSets.push({ value: label, code })
      }
    })
    ctrl.valueSets = valueSets
    if (selectedCodes.length > 0) {
      ctrl.code = selectedCodes.join(',')
    }
  } else if (dynamicData && typeof dynamicData === 'object') {
    if (Array.isArray(dynamicData.options)) {
      dynamicData.options.forEach((item: any, idx: number) => {
        let label = item.label || item.text || item.name || item.value || `选项${idx + 1}`
        const code = String(item.value ?? item.code ?? item.id ?? `opt_${idx + 1}`)
        const shouldWrap =
          (isVertical && idx < dynamicData.options.length - 1) ||
          (isGrid && (idx + 1) % gridCols === 0 && idx < dynamicData.options.length - 1)
        if (shouldWrap && !label.endsWith('\n')) {
          label += '\n'
        }
        valueSets.push({ value: label, code })
      })
      ctrl.valueSets = valueSets
    }
    if (dynamicData.value !== undefined) {
      ctrl.code = String(dynamicData.value)
    }
  } else if (typeof dynamicData === 'string' || typeof dynamicData === 'number') {
    ctrl.code = String(dynamicData)
  }
}




/** 提取单元格内的实际显示文本（包括普通文本元素、控件内部值及占位符等） */
export function getTdText(td: ITd | undefined): string {
  if (!td || !td.value) return ''
  let text = ''
  for (const el of td.value) {
    if (el.type === ElementType.CONTROL && el.control) {
      if (Array.isArray(el.control.value)) {
        text += el.control.value.map(c => c.value || '').join('')
      } else if (typeof el.control.value === 'string') {
        text += el.control.value
      } else if (el.control.code) {
        text += el.control.code
      }
    } else if (el.value) {
      text += el.value
    }
  }
  return text.trim()
}

/**
 * 3. 声明式相邻相同数据动态合并算法 (Declared Same Content Auto Merge)
 * 扫描带有 mergeSame 标记（来自 HTML 模板的 merge-same 指令）的单元格，
 * 动态执行垂直方向合并同类项
 */
export function applyDeclaredSameMerge(tableElement: IElement): void {
  const trList = tableElement.trList
  if (!trList || trList.length <= 1) return

  // 1. 查找数据起始行（跳过表头）
  let dataStartIndex = 0
  while (dataStartIndex < trList.length && trList[dataStartIndex]?.isHeader) {
    dataStartIndex++
  }
  if (dataStartIndex >= trList.length) return

  // 2. 在未压缩的初始行中，探测哪些逻辑列声明了垂直合并 (mergeSame)
  const refRow = trList[dataStartIndex]
  if (!refRow || !refRow.tdList) return

  const verticalMergeCols: number[] = []
  refRow.tdList.forEach((td, colIdx) => {
    if (td.mergeSame === 'vertical' || td.mergeSame === (true as any)) {
      verticalMergeCols.push(colIdx)
    }
  })

  // 3. 垂直方向合并：对声明了 merge-same 的列进行连续相同内容纵向合并
  verticalMergeCols.forEach(colIdx => {
    let r = dataStartIndex
    while (r < trList.length) {
      if (trList[r]?.isHeader) {
        r++
        continue
      }
      const startTd = trList[r]?.tdList?.[colIdx]
      if (!startTd || startTd._remove) {
        r++
        continue
      }
      const startVal = getTdText(startTd)
      if (!startVal) {
        r++
        continue
      }

      let spanCount = 1
      for (let nextRow = r + 1; nextRow < trList.length; nextRow++) {
        if (trList[nextRow]?.isHeader) break
        const nextTd = trList[nextRow]?.tdList?.[colIdx]
        if (!nextTd || nextTd._remove) break
        const nextVal = getTdText(nextTd)

        if (startVal === nextVal) {
          spanCount++
        } else {
          break
        }
      }

      if (spanCount > 1) {
        startTd.rowspan = spanCount
        for (let i = 1; i < spanCount; i++) {
          const targetTd = trList[r + i]?.tdList?.[colIdx]
          if (targetTd) {
            targetTd._remove = true
          }
        }
      }

      r += spanCount
    }
  })

  // 4. 统一过滤清理每行中被纵向合并移除的占位单元格 (_remove: true)
  trList.forEach(tr => {
    if (Array.isArray(tr.tdList)) {
      tr.tdList = tr.tdList.filter(td => !td._remove)
    }
  })
}

/**
 * 4. 通用数据驱动全局分发引擎（Generic Global Data Engine）
 * 纯根据数据特征和结构自适应决定渲染方式，绝无特定业务字段硬编码！
 */
export function applyGenericDataEngine(
  elementList: IElement[],
  businessData: any
): { rootValues: Array<{ conceptId: string; value: any }> } {
  const rootValues: Array<{ conceptId: string; value: any }> = []
  if (!businessData || typeof businessData !== 'object') return { rootValues }

  // 递归扫描并应用所有表格与控件
  const walkElements = (elements: IElement[]) => {
    if (!Array.isArray(elements)) return

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]

      // 1. 处理表格动态数据驱动 (精准识别循环块，完整保留表头与表尾合计/签名行)
      if (el.type === ElementType.TABLE && el.conceptId) {
        const tableData = getValueByPath(businessData, el.conceptId)
        if (Array.isArray(tableData) && tableData.length > 0 && Array.isArray(el.trList) && el.trList.length > 0) {
          // 1.1 定位循环模板行区间 [loopStartRow ... loopEndRow]
          let loopStartRow = -1
          let loopEndRow = -1

          for (let r = 0; r < el.trList.length; r++) {
            const tr = el.trList[r]
            if (tr.loopConfig?.isLoopRow) {
              if (loopStartRow === -1) loopStartRow = r
              loopEndRow = r
            } else if (loopStartRow !== -1 && !tr.isFooter) {
              // 遇到非循环行停止
              break
            }
          }

          // 兜底：若未显式标记 loopConfig，但表格有多行，将第 2 行（索引 1）作为默认循环模板行
          if (loopStartRow === -1) {
            loopStartRow = el.trList.length > 1 ? 1 : 0
            loopEndRow = loopStartRow
          }

          // 1.2 分离表头行与表尾固定行 (如合计行、签名行、多级表头)
          const headerRows = el.trList.slice(0, loopStartRow)
          const loopTemplateRows = el.trList.slice(loopStartRow, loopEndRow + 1)
          const footerRows = el.trList.slice(loopEndRow + 1)

          // 1.3 提取真正的明细模板行 (优先选择非 groupHeader 的明细行)
          const detailSampleTr =
            loopTemplateRows.find(
              (tr: any) => !tr.loopConfig?.isGroupHeader && !tr.isGroupHeader
            ) || loopTemplateRows[loopTemplateRows.length - 1]

          const columnKeys: string[] = []
          if (detailSampleTr && Array.isArray(detailSampleTr.tdList)) {
            detailSampleTr.tdList.forEach((td: any) => {
              let colKey = ''
              if (Array.isArray(td.value)) {
                const ctrlEl = td.value.find(
                  (subEl: any) =>
                    subEl.type === ElementType.CONTROL || subEl.control
                )
                if (ctrlEl?.control?.conceptId) {
                  colKey = ctrlEl.control.conceptId
                }
              }
              columnKeys.push(colKey)
            })
          }

          // 1. 计算表格真实总列数 (表头行 tdList 累加 colspan 或 colgroup 长度)
          let totalCols = el.colgroup?.length || 0
          if (!totalCols && headerRows.length > 0 && headerRows[0].tdList) {
            totalCols = headerRows[0].tdList.reduce((sum: number, td: any) => sum + (td.colspan || 1), 0)
          }
          if (!totalCols) {
            totalCols = detailSampleTr?.tdList?.reduce((sum: number, td: any) => sum + (td.colspan || 1), 0) || 4
          }

          // 1.4 通用数据行展开
          const expandedDataRows: ITr[] = []
          const isGroupedStructure =
            loopTemplateRows.length > 1 &&
            tableData.some(
              (item: any) =>
                item &&
                typeof item === 'object' &&
                (Array.isArray(item.children) ||
                  Array.isArray(item.tableData) ||
                  Array.isArray(item.items) ||
                  Array.isArray(item.data))
            )

          if (isGroupedStructure) {
            // 复合分组循环：每个 group 依次渲染大标题行 + 组内明细行
            tableData.forEach((groupItem: any, gIdx: number) => {
              loopTemplateRows.forEach((templateRow: ITr) => {
                const subRows =
                  groupItem.children ||
                  groupItem.tableData ||
                  groupItem.items ||
                  groupItem.data ||
                  []
                const isDetailLoopRow =
                  templateRow.loopConfig?.datasetId &&
                  templateRow.loopConfig.datasetId !== el.conceptId &&
                  !(templateRow.loopConfig as any)?.isGroupHeader

                if (isDetailLoopRow && Array.isArray(subRows)) {
                  // 展开该 group 内的明细数据行
                  subRows.forEach((rowItem: any) => {
                    const rowTdList: ITd[] = []
                    const rowKeys =
                      typeof rowItem === 'object' && rowItem !== null
                        ? Object.keys(rowItem)
                        : []

                    for (let c = 0; c < (templateRow.tdList?.length || totalCols); c++) {
                      const templateTd = templateRow.tdList?.[c]
                      let targetKey = columnKeys[c] || ''
                      if (targetKey.includes('.')) targetKey = targetKey.split('.').pop()!
                      if (targetKey.includes('[')) targetKey = targetKey.replace(/\[.*\]/g, '')

                      // 检查单元格内是否包含控件
                      const hasControls = templateTd?.value?.some(
                        (e: any) => e.type === ElementType.CONTROL || e.control
                      )

                      if (hasControls && templateTd?.value) {
                        const cellElements: IElement[] = []
                        const visitedControlIds = new Set<string>()

                        templateTd.value.forEach((e: any) => {
                          if (e.type === ElementType.CONTROL || e.control) {
                            const controlId =
                              e.controlId || e.control?.conceptId || 'anonymous'
                            if (visitedControlIds.has(controlId)) {
                              // 已渲染过该控件的值，跳过该控件后续字符/后缀节点
                              return
                            }
                            visitedControlIds.add(controlId)

                            let key = e.control?.conceptId || ''
                            if (key.includes('.')) key = key.split('.').pop()!
                            let val = rowItem[key]
                            if (val === undefined && targetKey) val = rowItem[targetKey]
                            if (val === undefined) val = getValueByPath(rowItem, key)

                            if (
                              Array.isArray(val) &&
                              val.some(
                                (it: any) =>
                                  (typeof it === 'string' &&
                                    (it.startsWith('http') ||
                                      it.startsWith('data:image'))) ||
                                  it?.url
                              )
                            ) {
                              cellElements.push(...formatListImageElements(val, { width: 42, height: 42 }))
                            } else {
                              const strVal =
                                val !== undefined && val !== null ? String(val) : ''
                              splitText(strVal).forEach(ch => {
                                cellElements.push({
                                  value: ch,
                                  color: e.color,
                                  bold: e.bold,
                                  size: e.size
                                })
                              })
                            }
                          } else if (!e.control && !e.controlId) {
                            // 普通静态文本 (如 " - ") 原样保留
                            cellElements.push({ ...e })
                          }
                        })

                        if (cellElements.length === 0) cellElements.push({ value: '-' })
                        rowTdList.push({
                          colspan: templateTd?.colspan || 1,
                          rowspan: 1,
                          mergeSame: templateTd?.mergeSame,
                          backgroundColor: templateTd?.backgroundColor,
                          value: cellElements
                        })
                      } else {
                        let cellVal: any = undefined
                        if (targetKey && rowItem[targetKey] !== undefined) {
                          cellVal = rowItem[targetKey]
                        } else if (targetKey) {
                          cellVal = getValueByPath(rowItem, targetKey)
                        }
                        if (cellVal === undefined && rowKeys[c] !== undefined) {
                          cellVal = rowItem[rowKeys[c]]
                        }

                        if (
                          Array.isArray(cellVal) &&
                          cellVal.some(
                            (it: any) =>
                              (typeof it === 'string' &&
                                (it.startsWith('http') ||
                                  it.startsWith('data:image'))) ||
                              it?.url
                          )
                        ) {
                          const imgElements = formatListImageElements(cellVal, { width: 42, height: 42 })
                          if (imgElements.length === 0) imgElements.push({ value: '-' })
                          rowTdList.push({
                            colspan: templateTd?.colspan || 1,
                            rowspan: 1,
                            mergeSame: templateTd?.mergeSame,
                            backgroundColor: templateTd?.backgroundColor,
                            value: imgElements
                          })
                        } else {
                          const strVal =
                            cellVal !== undefined && cellVal !== null
                              ? String(cellVal)
                              : ''
                          rowTdList.push({
                            colspan: templateTd?.colspan || 1,
                            rowspan: 1,
                            mergeSame: templateTd?.mergeSame,
                            backgroundColor: templateTd?.backgroundColor,
                            value: splitText(strVal).map(ch => ({
                              value: ch
                            }))
                          })
                        }
                      }
                    }

                    expandedDataRows.push({
                      height: rowTdList.some(td =>
                        td.value.some(e => e.type === ElementType.IMAGE)
                      )
                        ? 48
                        : templateRow.height || 36,
                      minHeight: templateRow.minHeight || 36,
                      tdList: rowTdList
                    })
                  })
                } else {
                  // 该 group 的大标题通栏行
                  const bannerTdList: ITd[] = []
                  ;(templateRow.tdList || []).forEach((templateTd: any) => {
                    let titleText = ''
                    const ctrl = templateTd.value?.find(
                      (e: any) => e.type === ElementType.CONTROL || e.control
                    )
                    let key = ctrl?.control?.conceptId || 'title'
                    if (key.includes('.')) key = key.split('.').pop()!

                    if (groupItem[key] !== undefined) {
                      titleText = String(groupItem[key])
                    } else {
                      titleText =
                        groupItem.title ||
                        groupItem.name ||
                        groupItem.groupTitle ||
                        `分组 ${gIdx + 1}`
                    }

                    // 保留大标题前置图标/装饰（如 ■ ），避免被多个字符节点重复追加
                    const bannerElements: IElement[] = []
                    const visitedTitleIds = new Set<string>()
                    let renderedTitle = false

                    templateTd.value?.forEach((e: any) => {
                      if (e.type === ElementType.CONTROL || e.control) {
                        const cId = e.controlId || 'title-ctrl'
                        if (visitedTitleIds.has(cId)) return
                        visitedTitleIds.add(cId)

                        splitText(titleText).forEach(ch =>
                          bannerElements.push({ value: ch, bold: true, size: 13 })
                        )
                        renderedTitle = true
                      } else if (!e.control && !e.controlId) {
                        bannerElements.push({ ...e, bold: true })
                      }
                    })
                    if (!renderedTitle) {
                      bannerElements.push(
                        ...splitText(titleText).map(c => ({
                          value: c,
                          bold: true,
                          size: 13
                        }))
                      )
                    }

                    bannerTdList.push({
                      colspan: templateTd.colspan || totalCols,
                      rowspan: 1,
                      mergeSame: templateTd.mergeSame,
                      backgroundColor: templateTd.backgroundColor || '#F2F4F8',
                      value: bannerElements
                    })
                  })

                  expandedDataRows.push({
                    height: templateRow.height || 32,
                    minHeight: 32,
                    tdList: bannerTdList
                  })
                }
              })
            })
          } else {
            // 普通单层明细数据循环
            tableData.forEach((rowItem: any) => {
              loopTemplateRows.forEach((templateRow: ITr) => {
                const defaultKeys =
                  typeof rowItem === 'object' && rowItem !== null
                    ? Object.keys(rowItem)
                    : []
                const tdList: ITd[] = []

                for (let c = 0; c < (templateRow.tdList?.length || totalCols); c++) {
                  const templateTd = templateRow.tdList?.[c]
                  let targetKey = columnKeys[c] || ''
                  if (targetKey.includes('.')) targetKey = targetKey.split('.').pop()!
                  if (targetKey.includes('[')) targetKey = targetKey.replace(/\[.*\]/g, '')

                  const hasControls = templateTd?.value?.some(
                    (e: any) => e.type === ElementType.CONTROL || e.control
                  )

                  if (hasControls && templateTd?.value) {
                    const cellElements: IElement[] = []
                    const visitedControlIds = new Set<string>()

                    templateTd.value.forEach((e: any) => {
                      if (e.type === ElementType.CONTROL || e.control) {
                        const controlId =
                          e.controlId || e.control?.conceptId || 'anonymous'
                        if (visitedControlIds.has(controlId)) return
                        visitedControlIds.add(controlId)

                        let key = e.control?.conceptId || ''
                        if (key.includes('.')) key = key.split('.').pop()!
                        let val = rowItem[key]
                        if (val === undefined && targetKey) val = rowItem[targetKey]
                        if (val === undefined) val = getValueByPath(rowItem, key)

                        if (
                          Array.isArray(val) &&
                          val.some(
                            (it: any) =>
                              (typeof it === 'string' &&
                                (it.startsWith('http') ||
                                  it.startsWith('data:image'))) ||
                              it?.url
                          )
                        ) {
                          cellElements.push(...formatListImageElements(val, { width: 42, height: 42 }))
                        } else {
                          const strVal =
                            val !== undefined && val !== null ? String(val) : ''
                          splitText(strVal).forEach(ch => {
                            cellElements.push({
                              value: ch,
                              color: e.color,
                              bold: e.bold,
                              size: e.size
                            })
                          })
                        }
                      } else if (!e.control && !e.controlId) {
                        cellElements.push({ ...e })
                      }
                    })

                    if (cellElements.length === 0) cellElements.push({ value: '-' })
                    tdList.push({
                      colspan: templateTd?.colspan || 1,
                      rowspan: 1,
                      mergeSame: templateTd?.mergeSame,
                      backgroundColor: templateTd?.backgroundColor,
                      value: cellElements
                    })
                  } else {
                    let cellVal: any = undefined
                    if (targetKey && rowItem[targetKey] !== undefined) {
                      cellVal = rowItem[targetKey]
                    } else if (targetKey) {
                      cellVal = getValueByPath(rowItem, targetKey)
                    }
                    if (cellVal === undefined && defaultKeys[c] !== undefined) {
                      cellVal = rowItem[defaultKeys[c]]
                    }

                    if (
                      Array.isArray(cellVal) &&
                      cellVal.some(
                        (it: any) =>
                          (typeof it === 'string' &&
                            (it.startsWith('http') ||
                              it.startsWith('data:image'))) ||
                          it?.url
                      )
                    ) {
                      const imgElements = formatListImageElements(cellVal, { width: 42, height: 42 })
                      if (imgElements.length === 0) imgElements.push({ value: '-' })
                      tdList.push({
                        colspan: templateTd?.colspan || 1,
                        rowspan: 1,
                        mergeSame: templateTd?.mergeSame,
                        backgroundColor: templateTd?.backgroundColor,
                        value: imgElements
                      })
                    } else {
                      const strVal =
                        cellVal !== undefined && cellVal !== null
                          ? String(cellVal)
                          : ''
                      tdList.push({
                        colspan: templateTd?.colspan || 1,
                        rowspan: 1,
                        mergeSame: templateTd?.mergeSame,
                        backgroundColor: templateTd?.backgroundColor,
                        value: splitText(strVal).map(ch => ({
                          value: ch
                        }))
                      })
                    }
                  }
                }

                expandedDataRows.push({
                  height: tdList.some(td => td.value.some(e => e.type === ElementType.IMAGE)) ? 48 : templateRow.height || 36,
                  minHeight: templateRow.minHeight || 36,
                  tdList
                })
              })
            })
          }

          // 1.5 组合最终表格行（表头 + 展开数据明细 + 表尾合计行）
          el.trList = [...headerRows, ...expandedDataRows, ...footerRows]

          // 1.6 根据 HTML 模板中单元格显式声明的 mergeSame 标记（merge-same）执行声明式合并
          applyDeclaredSameMerge(el)
        }
      }

      // 2. 处理动态 Checkbox / Radio / List.Image 选项与数据驱动
      if (el.type === ElementType.CONTROL && el.control?.conceptId) {
        const conceptId = el.control.conceptId
        const fieldData = getValueByPath(businessData, conceptId)
        if (fieldData !== undefined && fieldData !== null) {
          if (
            el.control.type === ControlType.CHECKBOX ||
            el.control.type === ControlType.RADIO ||
            el.control.type === ControlType.SELECT
          ) {
            renderDynamicOptions(el, fieldData)
            if (el.control.code !== undefined && el.control.code !== null) {
              rootValues.push({ conceptId, value: el.control.code })
            }
          } else if (
            el.control.listType === 'image' ||
            (el.control.type === ControlType.IMAGE && Array.isArray(fieldData))
          ) {
            const imgElements = formatListImageElements(fieldData, {
              width: el.control.width || 80,
              height: el.control.height || 80,
              layout: el.control.layout || 'grid',
              gridCols: el.control.gridCols || 3
            })
            el.control.value = imgElements
          }
        }
      }

      // 递归处理子表格单元格
      if (el.type === ElementType.TABLE && Array.isArray(el.trList)) {
        el.trList.forEach(tr => {
          if (Array.isArray(tr.tdList)) {
            tr.tdList.forEach(td => {
              if (Array.isArray(td.value)) {
                walkElements(td.value)
              }
            })
          }
        })
      }
    }
  }

  walkElements(elementList)
  return { rootValues }
}
