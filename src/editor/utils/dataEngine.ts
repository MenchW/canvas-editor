import { ElementType } from '../dataset/enum/Element'
import { IElement } from '../interface/Element'
import { ITd } from '../interface/table/Td'
import { ITr } from '../interface/table/Tr'
import { ZERO } from '../dataset/constant/Common'
import { splitText, getValueByPath, deepClone, getUUID } from './index'

/** 标准化将图片列表/数组展开为 IElement 序列 */
export function formatListImageElements(
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
export function renderDynamicOptions(
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
    if (dynamicData.value !== undefined || dynamicData.code !== undefined) {
      ctrl.code = String(dynamicData.value ?? dynamicData.code)
    }
  }
}

/** 获取单元格纯文本内容 */
export function getTdText(td: ITd): string {
  if (!td || !Array.isArray(td.value)) return ''
  return td.value
    .filter(
      (el: any) =>
        el.controlComponent !== 'prefix' && el.controlComponent !== 'postfix'
    )
    .map((el: IElement) => el.value || '')
    .join('')
    .trim()
}

/**
 * 声明式相同内容相邻合并（Declared Same Merge）
 * 仅对显式声明了 td.mergeSame: 'vertical' | true 的列进行纵向连续同值合并
 */
export function applyDeclaredSameMerge(trListOrTable: any): void {
  const trList: ITr[] = Array.isArray(trListOrTable)
    ? trListOrTable
    : trListOrTable?.trList
  if (!Array.isArray(trList) || trList.length === 0) return

  // 1. 定位数据首行（跳过 isHeader 行）
  let dataStartIndex = -1
  for (let r = 0; r < trList.length; r++) {
    if (!trList[r].isHeader) {
      dataStartIndex = r
      break
    }
  }
  if (dataStartIndex === -1) return

  // 2. 探测哪些逻辑列声明了垂直合并 (mergeSame)
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
      if (!startTd || (startTd as any)._remove) {
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
        if (!nextTd || (nextTd as any)._remove) break
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
            ;(targetTd as any)._remove = true
          }
        }
      }

      r += spanCount
    }
  })

  // 4. 统一过滤清理每行中被纵向合并移除的占位单元格 (_remove: true)
  trList.forEach(tr => {
    if (Array.isArray(tr.tdList)) {
      tr.tdList = tr.tdList.filter(td => !(td as any)._remove)
    }
  })
}

/** 轻量模板行克隆（复用不变的单元格样式属性，仅克隆动态结构与元素数组，降低 GC 压力） */
export function cloneTrTemplate(tr: any): any {
  if (!tr) return tr
  const clonedTrId = getUUID()
  const clonedTdList = Array.isArray(tr.tdList)
    ? tr.tdList.map((td: any) => {
        const clonedTdId = getUUID()
        const clonedValue = Array.isArray(td.value) ? deepClone(td.value) : td.value
        if (Array.isArray(clonedValue)) {
          clonedValue.forEach((el: any) => {
            el.tdId = clonedTdId
            el.trId = clonedTrId
          })
        }
        const clonedTd = {
          ...td,
          id: clonedTdId,
          value: clonedValue
        }
        delete (clonedTd as any)._isUnzipped
        delete (clonedTd as any)._lastFingerprint
        return clonedTd
      })
    : []
  const clonedTr = {
    ...tr,
    id: clonedTrId,
    tdList: clonedTdList
  }
  delete clonedTr.loopConfig
  return clonedTr
}

/** 精准判断字段名是否代表图片（采用词边界正则，支持驼峰/下划线/点号，避免误伤 topic、typical、spicy 等非图片词） */
export function isImageConceptName(conceptId: string): boolean {
  if (!conceptId) return false
  return (
    /(?:^|[._A-Z])(?:img|imgs|image|images|photo|photos|picture|pictures|pic|pics|avatar)(?:[._A-Z0-9]|$|list|url|path)/i.test(
      conceptId
    ) ||
    /(?:^|[._])(?:img|imgs|image|images|photo|photos|picture|pictures|pic|pics|avatar)(?:[._]|$)/i.test(
      conceptId
    )
  )
}

/** 精准判断值是否代表图片内容（URL、Base64 或包含 url/src 的对象） */
export function isImageValue(val: any): boolean {
  if (!val) return false
  if (typeof val === 'string') {
    return (
      val.startsWith('data:image/') ||
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      /\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?.*)?$/i.test(val)
    )
  }
  if (typeof val === 'object' && val !== null) {
    if (val.url || val.src) return true
    if (Array.isArray(val)) {
      return val.length > 0 && val.some(isImageValue)
    }
  }
  return false
}

/** 综合判定是否为图片控件/字段 */
export function isImageField(
  control: any,
  conceptId: string,
  value: any
): boolean {
  if (control?.type === 'image' || (control as any)?.listType === 'image') {
    return true
  }
  if (isImageValue(value)) return true
  if (isImageConceptName(conceptId)) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      Array.isArray(value) ||
      isImageValue(value)
    ) {
      return true
    }
  }
  return false
}

/**
 * 通用树形/多级模板行递归展开器（通用支持 1 级、2 级、3 级及任意深度 N 级树形嵌套）
 */
export function renderCompositeDetailTrs(
  detailTrs: any[],
  parentItem: any,
  parentAlias: string | undefined,
  walkTd: (tdList: any[], context: any) => void,
  remapControlIdsAndCollect: (tr: any, context: any) => void
): any[] {
  if (!detailTrs || !detailTrs.length) return []
  const result: any[] = []

  const firstTr = detailTrs[0]
  const firstAlias = firstTr.loopConfig?.itemAlias

  // 检查后续的 tr 是否为 firstTr 的子孙行（即其 sourcePath / datasetId 以 firstAlias + '.' 开头）
  const isChildOfFirst = (tr: any) => {
    if (!firstAlias || !tr.loopConfig) return false
    const dId = tr.loopConfig.datasetId || ''
    const sPath = tr.loopConfig.sourcePath || ''
    return (
      dId.startsWith(`${firstAlias}.`) ||
      sPath.startsWith(`${firstAlias}.`) ||
      sPath === `${firstAlias}.children` ||
      sPath === `${firstAlias}.items`
    )
  }

  // 收集属于 firstTr 子行的连续模板行
  const childTrs: any[] = []
  let nextIdx = 1
  while (nextIdx < detailTrs.length && isChildOfFirst(detailTrs[nextIdx])) {
    childTrs.push(detailTrs[nextIdx])
    nextIdx++
  }

  // 提取 firstTr 对应的数据行
  let firstDatasetId = firstTr.loopConfig?.datasetId || ''
  if (parentAlias && firstDatasetId.startsWith(`${parentAlias}.`)) {
    firstDatasetId = firstDatasetId.slice(parentAlias.length + 1)
  }
  const firstData =
    parentItem && typeof parentItem === 'object'
      ? (firstDatasetId
          ? getValueByPath(parentItem, firstDatasetId) ??
            parentItem[firstDatasetId]
          : null) ||
        parentItem.children ||
        parentItem.items ||
        parentItem.data ||
        parentItem.tableData
      : null
  const firstRows = Array.isArray(firstData) ? firstData : []

  firstRows.forEach((item: any) => {
    if (!firstTr.when || !item || evaluateWhenCondition(firstTr.when, item)) {
      const clonedTr = cloneTrTemplate(firstTr)
      remapControlIdsAndCollect(clonedTr, item)
      walkTd(clonedTr.tdList, item)
      result.push(clonedTr)
    }
    // 如果存在子行，递归展开子行
    if (childTrs.length > 0) {
      const subResult = renderCompositeDetailTrs(
        childTrs,
        item,
        firstAlias,
        walkTd,
        remapControlIdsAndCollect
      )
      result.push(...subResult)
    }
  })

  // 处理剩余同级兄弟行（若有）
  if (nextIdx < detailTrs.length) {
    const siblingTrs = detailTrs.slice(nextIdx)
    const siblingResult = renderCompositeDetailTrs(
      siblingTrs,
      parentItem,
      parentAlias,
      walkTd,
      remapControlIdsAndCollect
    )
    result.push(...siblingResult)
  }

  return result
}

/** 展开循环表格（统一数据驱动核心引擎） */
export function expandLoopTables(
  elementList: any[],
  businessData: any,
  parentContext: any = null,
  depth = 0,
  isDesignMode = false
) {
  if (!Array.isArray(elementList) || depth > 20) return

  const walkTd = (tdList: any[], context: any) => {
    if (!Array.isArray(tdList)) return
    tdList.forEach((td: any) => {
      if (Array.isArray(td.value)) {
        expandLoopTables(
          td.value,
          businessData,
          context,
          depth + 1,
          isDesignMode
        )
      }
    })
  }

  for (let i = 0; i < elementList.length; i++) {
    const el = elementList[i]
    if (el.type !== 'table' || !Array.isArray(el.trList)) continue

    // 关键保护：首次遇到表格时，备份其原始模板结构 rawTrList
    // 若显式处于设计态 (isDesignMode) 或表格结构发生改变，重新备份当前结构
    if (!el.rawTrList || isDesignMode) {
      el.rawTrList = deepClone(el.trList)
    }

    const newTrList: any[] = []
    // 直接只读遍历原始模板行，实际注入生成的新行由 cloneTrTemplate 负责轻量克隆，免除整表全量重复深克隆
    const trList = el.rawTrList

    for (let r = 0; r < trList.length; r++) {
      const tr = trList[r]
      const loopConfig = tr.loopConfig

      if (loopConfig?.isLoopRow) {
        const blockEnd = Math.max(
          r,
          loopConfig.endTrIndex !== undefined
            ? Math.min(loopConfig.endTrIndex, trList.length - 1)
            : r
        )
        const datasetId = loopConfig.datasetId
        const listData = getValueByPath(
          parentContext || businessData,
          datasetId
        )
        const dataRows =
          Array.isArray(listData) && listData.length > 0 ? listData : [null]

        // 收集该块内的所有模板行
        const blockTemplateTrs: any[] = []
        for (let br = r; br <= blockEnd; br++) {
          blockTemplateTrs.push(trList[br])
        }

        const hasDetailRows = blockTemplateTrs.some(
          t => t.loopConfig && t.loopConfig.isDetailRow
        )

        // 兼顾旧版 isGroupHeader
        const isLegacyGroupHeader =
          loopConfig.isGroupHeader &&
          trList[r + 1]?.loopConfig?.isLoopRow &&
          !trList[r + 1]?.loopConfig?.isGroupHeader

        const isGroupMode =
          Boolean(loopConfig.isTbodyGroup) || Boolean(loopConfig.isGroupHeader)

        if (isGroupMode && (hasDetailRows || isLegacyGroupHeader)) {
          // 场景 A：分组复合表（包含 1 个或多个大标题头行 + 1 个或多个子明细行）
          let effectiveBlockEnd = blockEnd
          let headerTemplateTrs: any[] = []
          let detailTemplateTrs: any[] = []

          if (isLegacyGroupHeader && !hasDetailRows) {
            effectiveBlockEnd = r + 1
            headerTemplateTrs = [tr]
            detailTemplateTrs = [trList[r + 1]]
          } else {
            headerTemplateTrs = blockTemplateTrs.filter(
              t => !t.loopConfig || !t.loopConfig.isDetailRow
            )
            detailTemplateTrs = blockTemplateTrs.filter(
              t => t.loopConfig && t.loopConfig.isDetailRow
            )
          }

          dataRows.forEach((groupItem: any) => {
            // 1. 先渲染当前 groupItem 的所有头部行（如一级大类、二级子类）
            headerTemplateTrs.forEach((headerTr: any) => {
              if (
                headerTr.when &&
                groupItem &&
                !evaluateWhenCondition(headerTr.when, groupItem)
              ) {
                return
              }
              const clonedHeaderTr = cloneTrTemplate(headerTr)
              remapControlIdsAndCollect(clonedHeaderTr, groupItem)
              walkTd(clonedHeaderTr.tdList, groupItem)
              newTrList.push(clonedHeaderTr)
            })

            // 2. 紧接着通用递归渲染子明细行（通用支持任意深度 N 级树形嵌套与多明细行）
            if (detailTemplateTrs.length > 0) {
              const expandedDetailTrs = renderCompositeDetailTrs(
                detailTemplateTrs,
                groupItem,
                loopConfig.itemAlias,
                walkTd,
                remapControlIdsAndCollect
              )
              newTrList.push(...expandedDetailTrs)
            }
          })

          r = effectiveBlockEnd
        } else {
          // 场景 B：普通单行循环或纯平级多行模板
          dataRows.forEach(itemData => {
            for (let br = r; br <= blockEnd; br++) {
              const currentTemplateTr = trList[br]
              const whenExpr = currentTemplateTr.when
              if (
                whenExpr &&
                itemData &&
                !evaluateWhenCondition(whenExpr, itemData)
              ) {
                continue
              }
              const clonedTr = cloneTrTemplate(currentTemplateTr)
              remapControlIdsAndCollect(clonedTr, itemData)
              walkTd(clonedTr.tdList, itemData)
              newTrList.push(clonedTr)
            }
          })
          r = blockEnd
        }
      } else {
        const whenExpr = tr.when
        if (
          !whenExpr ||
          evaluateWhenCondition(whenExpr, parentContext || businessData)
        ) {
          remapControlIdsAndCollect(tr, parentContext || businessData)
          walkTd(tr.tdList, parentContext)
          newTrList.push(tr)
        }
      }
    }

    newTrList.forEach(tr => {
      if (Array.isArray(tr.tdList)) {
        tr.tdList.forEach((td: any) => {
          if (Array.isArray(td.value)) {
            td.value.forEach((valEl: any) => {
              valEl.tdId = td.id
              valEl.trId = tr.id
              valEl.tableId = el.id
            })
          }
        })
      }
    })

    el.trList = newTrList
  }
}

/** 从 itemData 结构化数据中按 conceptId 安全提取字段值 */
export function getItemValue(itemData: any, conceptId: string): any {
  if (!itemData || !conceptId) return undefined

  // 1. 直接按原始键名取值
  if (itemData[conceptId] !== undefined && itemData[conceptId] !== null) {
    return itemData[conceptId]
  }

  // 逐级剥离循环前缀别名（例如 item.userName -> userName）
  if (conceptId.includes('.')) {
    const parts = conceptId.split('.')
    for (let i = 1; i < parts.length; i++) {
      const subKey = parts.slice(i).join('.')
      if (itemData[subKey] !== undefined && itemData[subKey] !== null) {
        return itemData[subKey]
      }
      const subVal = getValueByPath(itemData, subKey)
      if (subVal !== undefined && subVal !== null) {
        return subVal
      }
    }
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
  }

  return undefined
}

/** 条件表达式安全求值 */
export function evaluateWhenCondition(expr: string, itemData: any): boolean {
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

/** 单元格内 Remap 控件 ID 与数据回显展开 */
export function remapControlIdsAndCollect(tr: any, itemData: any) {
  const idMap = new Map<string, string>()

  ;(tr.tdList || []).forEach((td: any) => {
    if (!Array.isArray(td.value)) return

    const processedControlIds = new Set<string>()

    // 0. 根据 when 条件过滤当前单元格内不满足条件的元素
    if (itemData) {
      td.value = td.value.filter((el: any) => {
        if (!el.when) return true
        return evaluateWhenCondition(el.when, itemData)
      })
    }

    // 1. 自动容错嗅探补全缺失的 innerLoop 标记
    let detectedAlias: string | null = null
    let detectedDataset: string | null = null
    for (const el of td.value) {
      if (el.innerLoop?.datasetId) {
        detectedDataset = el.innerLoop.datasetId
        break
      }
      const ph = el.control?.placeholder || el.placeholder
      if (ph && ph.includes('.')) {
        const parts = ph.split('.')
        const alias = parts[0]
        const field = parts.slice(1).join('.')
        if (itemData && typeof itemData === 'object') {
          for (const key of Object.keys(itemData)) {
            const candidate = itemData[key]
            if (
              Array.isArray(candidate) &&
              (key.toLowerCase().includes(alias.toLowerCase()) ||
                (candidate[0] &&
                  typeof candidate[0] === 'object' &&
                  candidate[0][field] !== undefined))
            ) {
              detectedAlias = alias
              detectedDataset = key
              break
            }
          }
        }
      }
    }

    if (detectedDataset && !td.value.some((el: any) => el.innerLoop?.isLoop)) {
      const autoBlockId = getUUID()
      td.value.forEach((el: any) => {
        el.innerLoop = {
          isLoop: true,
          datasetId: detectedDataset!,
          itemAlias: detectedAlias || 'item',
          isBlock: true,
          loopBlockId: autoBlockId
        }
      })
    }

    // 1.4 增强同块内丢失 innerLoop 的控件节点自愈补齐
    const existingLoopConfigs: any[] = []
    td.value.forEach((el: any) => {
      if (el.innerLoop?.isLoop && el.innerLoop.datasetId) {
        if (
          !existingLoopConfigs.some(
            c => c.loopBlockId === el.innerLoop.loopBlockId
          )
        ) {
          existingLoopConfigs.push(el.innerLoop)
        }
      }
    })

    if (existingLoopConfigs.length > 0) {
      existingLoopConfigs.forEach(loopCfg => {
        const itemAlias = loopCfg.itemAlias || 'item'
        const aliasPrefix = `${itemAlias}.`
        td.value.forEach((el: any) => {
          if (!el.innerLoop) {
            const ph = el.control?.placeholder || el.placeholder || ''
            const cid = el.control?.conceptId || el.conceptId || ''
            if (
              ph.startsWith(aliasPrefix) ||
              cid.startsWith(aliasPrefix) ||
              ph === itemAlias ||
              cid === itemAlias
            ) {
              el.innerLoop = { ...loopCfg }
            }
          }
        })
      })
    }

    // 1.5 扫描并展开单元格内标签级别的 innerLoop
    const loopBlockMap = new Map<
      string,
      { startIndex: number; endIndex: number; nodes: any[]; config: any }
    >()
    for (let k = 0; k < td.value.length; k++) {
      const nodeEl = td.value[k]
      if (nodeEl.innerLoop && nodeEl.innerLoop.isLoop) {
        const blkId =
          nodeEl.innerLoop.loopBlockId ||
          `loop_${nodeEl.innerLoop.datasetId || 'default'}`
        nodeEl.innerLoop.loopBlockId = blkId
        if (!loopBlockMap.has(blkId)) {
          loopBlockMap.set(blkId, {
            startIndex: k,
            endIndex: k,
            nodes: [nodeEl],
            config: nodeEl.innerLoop
          })
        } else {
          const entry = loopBlockMap.get(blkId)!
          entry.endIndex = k
          entry.nodes.push(nodeEl)
        }
      }
    }

    if (loopBlockMap.size > 0) {
      const sortedBlocks = Array.from(loopBlockMap.values()).sort(
        (a, b) => b.startIndex - a.startIndex
      )
      sortedBlocks.forEach(blk => {
        const datasetId = blk.config.datasetId
        let listData = getValueByPath(itemData, datasetId)
        if (listData === undefined && datasetId && datasetId.includes('.')) {
          const cleanKey = datasetId.split('.').slice(1).join('.')
          listData =
            getValueByPath(itemData, cleanKey) ??
            (itemData && typeof itemData === 'object'
              ? itemData[cleanKey]
              : undefined)
        }
        if (listData === undefined && itemData && typeof itemData === 'object') {
          listData =
            itemData[datasetId] ??
            itemData.tags ??
            itemData.items ??
            itemData.children ??
            itemData.data ??
            itemData.list
        }
        const dataRows = Array.isArray(listData)
          ? listData.length > 0
            ? listData
            : []
          : [null]
        const expandedNodes: any[] = []

        interface ILoopToken {
          isControl: boolean
          control?: any
          conceptId?: string
          placeholder?: string
          baseStyle: any
          rawNodes: any[]
        }

        const tokens: ILoopToken[] = []
        let currentControlToken: ILoopToken | null = null

        blk.nodes.forEach((nodeEl: any) => {
          const controlId = nodeEl.controlId
          const control = nodeEl.control
          if (controlId || control || nodeEl.type === 'control') {
            if (
              currentControlToken &&
              currentControlToken.rawNodes[0]?.controlId === controlId &&
              controlId
            ) {
              currentControlToken.rawNodes.push(nodeEl)
            } else {
              currentControlToken = {
                isControl: true,
                control: control || nodeEl.control,
                conceptId: control?.conceptId || nodeEl.conceptId || '',
                placeholder: control?.placeholder || nodeEl.placeholder || '',
                baseStyle: deepClone(nodeEl),
                rawNodes: [nodeEl]
              }
              tokens.push(currentControlToken)
            }
          } else {
            currentControlToken = null
            tokens.push({
              isControl: false,
              baseStyle: deepClone(nodeEl),
              rawNodes: [nodeEl]
            })
          }
        })

        dataRows.forEach((subItem: any, rowIdx: number) => {
          if (rowIdx > 0) {
            if (blk.config.isBlock !== false) {
              expandedNodes.push({ value: ZERO })
            } else {
              expandedNodes.push({ value: ' ' })
            }
          }

          tokens.forEach(token => {
            if (token.isControl) {
              const conceptId = token.conceptId || ''
              const aliasPrefix = `${blk.config.itemAlias}.`
              const cleanField = conceptId.startsWith(aliasPrefix)
                ? conceptId.slice(aliasPrefix.length)
                : conceptId

              let subVal: any = undefined
              if (subItem !== null && subItem !== undefined) {
                if (typeof subItem !== 'object') {
                  subVal = subItem
                } else {
                  subVal = getItemValue(subItem, conceptId)
                  if (subVal === undefined && cleanField !== conceptId) {
                    subVal = getItemValue(subItem, cleanField)
                  }
                  if (subVal === undefined) {
                    subVal = subItem[cleanField] ?? subItem[conceptId]
                  }
                  if (
                    subVal === undefined &&
                    (conceptId === blk.config.itemAlias ||
                      cleanField === blk.config.itemAlias)
                  ) {
                    subVal =
                      subItem.label ??
                      subItem.name ??
                      subItem.text ??
                      subItem.value ??
                      subItem.riskLevelName ??
                      subItem.desc
                  }
                }
              }
              if (subVal === undefined) {
                subVal = getItemValue(itemData, conceptId)
                if (subVal === undefined && cleanField !== conceptId) {
                  subVal = getItemValue(itemData, cleanField)
                }
              }

              const prefixChar = token.control?.prefix ?? '{'
              const postfixChar = token.control?.postfix ?? '}'
              const bracketColor = token.control?.bracketColor ?? '#000000'
              const placeholderColor =
                token.control?.placeholderColor ?? '#9c9b9b'

              // 精准判断是否为图片
              const isImg = isImageField(token.control, conceptId, subVal)

              if (isImg) {
                const rawUrls =
                  subVal !== undefined && subVal !== null && subVal !== ''
                    ? Array.isArray(subVal)
                      ? subVal
                      : [subVal]
                    : []
                const validImages = rawUrls
                  .map((v: any) =>
                    typeof v === 'object' && v !== null
                      ? v.url || v.src || String(v)
                      : String(v)
                  )
                  .filter((v: string) => v && isImageValue(v))

                if (validImages.length > 0) {
                  validImages.forEach((imgUrl: string, idx: number) => {
                    if (idx > 0) expandedNodes.push({ value: ' ' })
                    expandedNodes.push({
                      type: 'image',
                      value: imgUrl,
                      width: token.control?.width || 80,
                      height: token.control?.height || 80,
                      rowFlex: token.baseStyle?.rowFlex
                    })
                  })
                } else {
                  const fallbackPlaceholder = token.placeholder
                    ? token.placeholder
                    : cleanField
                  splitText(`{${fallbackPlaceholder}}`).forEach(ch => {
                    const phNode = deepClone(token.baseStyle)
                    delete phNode.innerLoop
                    delete phNode.control
                    delete phNode.controlId
                    delete phNode.controlComponent
                    phNode.type = undefined
                    phNode.color = placeholderColor
                    phNode.value = ch
                    expandedNodes.push(phNode)
                  })
                }
              } else {
                const newControlId = getUUID()
                processedControlIds.add(newControlId)
                let conceptId =
                  token.conceptId || token.control?.conceptId || ''
                let placeholder =
                  token.placeholder || token.control?.placeholder || ''
                if (!conceptId && !placeholder && token.rawNodes) {
                  const text = token.rawNodes
                    .filter(
                      (n: any) =>
                        n.controlComponent === 'placeholder' ||
                        n.controlComponent === 'value'
                    )
                    .map((n: any) => n.value)
                    .join('')
                  if (text) {
                    placeholder = text
                    conceptId = text
                  }
                }
                if (!conceptId && placeholder) conceptId = placeholder
                if (!placeholder && conceptId) placeholder = conceptId

                let cleanField = conceptId
                const itemAlias = blk.config.itemAlias || 'item'
                if (cleanField.startsWith(`${itemAlias}.`)) {
                  cleanField = cleanField.slice(itemAlias.length + 1)
                } else if (cleanField.startsWith('tag.')) {
                  cleanField = cleanField.slice(4)
                } else if (cleanField.startsWith('item.')) {
                  cleanField = cleanField.slice(5)
                } else if (cleanField.includes('.')) {
                  cleanField = cleanField.split('.').slice(1).join('.')
                }

                let subVal: any = undefined
                if (subItem !== null && subItem !== undefined) {
                  if (typeof subItem !== 'object') {
                    subVal = subItem
                  } else {
                    subVal =
                      subItem[cleanField] ??
                      getItemValue(subItem, cleanField) ??
                      subItem[conceptId] ??
                      getItemValue(subItem, conceptId)

                    if (subVal === undefined) {
                      subVal =
                        subItem.name ??
                        subItem.label ??
                        subItem.text ??
                        subItem.value ??
                        subItem.riskLevelName ??
                        subItem.desc
                    }
                  }
                }

                const fallbackPlaceholder =
                  placeholder || cleanField || conceptId
                const hasRealValue =
                  subVal !== undefined &&
                  subVal !== null &&
                  String(subVal).length > 0

                const controlObj = {
                  type: 'list',
                  listType: 'text',
                  conceptId: cleanField,
                  placeholder: fallbackPlaceholder,
                  prefix: prefixChar,
                  postfix: postfixChar,
                  bracketColor,
                  placeholderColor,
                  ...(token.control || {})
                }

                if (hasRealValue) {
                  controlObj.value = [
                    {
                      value: String(subVal),
                      rowFlex: token.baseStyle?.rowFlex,
                      color: token.baseStyle?.color
                    }
                  ]
                }

                const baseNode = deepClone(token.baseStyle || {})
                delete baseNode.innerLoop
                delete baseNode.isPlaceholder

                expandedNodes.push({
                  ...baseNode,
                  value: prefixChar,
                  type: 'text',
                  color: bracketColor,
                  controlId: newControlId,
                  control: controlObj,
                  controlComponent: 'prefix',
                  isPlaceholder: !hasRealValue
                })

                if (hasRealValue) {
                  splitText(String(subVal)).forEach((ch: string) => {
                    expandedNodes.push({
                      ...baseNode,
                      value: ch,
                      type: 'text',
                      controlId: newControlId,
                      control: controlObj,
                      controlComponent: 'value',
                      isPlaceholder: false
                    })
                  })
                } else {
                  splitText(fallbackPlaceholder).forEach((ch: string) => {
                    expandedNodes.push({
                      ...baseNode,
                      value: ch,
                      type: 'text',
                      color: placeholderColor,
                      controlId: newControlId,
                      control: controlObj,
                      controlComponent: 'placeholder',
                      isPlaceholder: true
                    })
                  })
                }

                expandedNodes.push({
                  ...baseNode,
                  value: postfixChar,
                  type: 'text',
                  color: bracketColor,
                  controlId: newControlId,
                  control: controlObj,
                  controlComponent: 'postfix',
                  isPlaceholder: !hasRealValue
                })
              }
            } else {
              token.rawNodes.forEach(rawNode => {
                const clonedNode = deepClone(rawNode)
                delete clonedNode.innerLoop
                if (clonedNode.type === 'checkbox' || clonedNode.checkbox) {
                  const isChecked = subItem
                    ? subItem.checked ??
                      subItem.isChecked ??
                      subItem.selected ??
                      subItem.isSelected
                    : undefined
                  if (isChecked !== undefined) {
                    clonedNode.checkbox = {
                      ...clonedNode.checkbox,
                      value:
                        typeof isChecked === 'boolean'
                          ? isChecked
                          : String(isChecked).toLowerCase() === 'true' ||
                            isChecked === '1' ||
                            isChecked === 1
                    }
                  }
                } else if (clonedNode.type === 'radio' || clonedNode.radio) {
                  const isChecked = subItem
                    ? subItem.checked ??
                      subItem.isChecked ??
                      subItem.selected ??
                      subItem.isSelected
                    : undefined
                  if (isChecked !== undefined) {
                    clonedNode.radio = {
                      ...clonedNode.radio,
                      value:
                        typeof isChecked === 'boolean'
                          ? isChecked
                          : String(isChecked).toLowerCase() === 'true' ||
                            isChecked === '1' ||
                            isChecked === 1
                    }
                  }
                }
                expandedNodes.push(clonedNode)
              })
            }
          })
        })

        td.value.splice(
          blk.startIndex,
          blk.endIndex - blk.startIndex + 1,
          ...expandedNodes
        )
      })
    }

    // 刷新 Remap 其余控件 ID
    td.value.forEach((el: any) => {
      if (el.controlId && processedControlIds.has(el.controlId)) return
      if (el.controlId || el.type === 'control' || el.control) {
        if (!el.controlId) {
          el.controlId = getUUID()
        } else if (!idMap.has(el.controlId)) {
          const newId = getUUID()
          idMap.set(el.controlId, newId)
          el.controlId = newId
        } else {
          el.controlId = idMap.get(el.controlId)!
        }
      }
    })

    // 扫描并处理普通字段回显
    for (let i = 0; i < td.value.length; i++) {
      const el = td.value[i]
      const control = el.control
      const conceptId = el.conceptId || control?.conceptId
      const targetControlId = el.controlId

      if (!conceptId || !targetControlId) continue
      if (processedControlIds.has(targetControlId)) continue

      const matchingIndices: number[] = []
      for (let j = 0; j < td.value.length; j++) {
        if (td.value[j].controlId === targetControlId) {
          matchingIndices.push(j)
        }
      }

      if (matchingIndices.length === 0) continue

      const val = getItemValue(itemData, conceptId)

      // 精准判断是否为图片字段
      const isImg = isImageField(control, conceptId, val)

      if (isImg) {
        const rawUrls =
          val !== undefined && val !== null && val !== ''
            ? Array.isArray(val)
              ? val
              : [val]
            : []
        const validImages = rawUrls
          .map((v: any) =>
            typeof v === 'object' && v !== null
              ? v.url || v.src || String(v)
              : String(v)
          )
          .filter((v: string) => v && isImageValue(v))

        const newNodes: any[] = []
        const baseNode = deepClone(td.value[matchingIndices[0]])
        const phText = control?.placeholder || conceptId || '现场照片'
        const bracketColor = control?.bracketColor || '#000000'
        const placeholderColor = '#c0c4cc'

        if (validImages.length > 0) {
          const imgListNodes: any[] = []
          validImages.forEach((imgUrl: string, idx: number) => {
            if (idx > 0) imgListNodes.push({ value: ' ' })
            imgListNodes.push({
              type: 'image',
              value: imgUrl,
              width: control?.width || 80,
              height: control?.height || 80
            })
          })
          const imgControlObj = {
            ...control,
            type: 'list',
            listType: 'image',
            conceptId,
            placeholder: phText,
            prefix: control?.prefix || '{',
            postfix: control?.postfix || '}',
            value: imgListNodes
          }
          newNodes.push({
            ...baseNode,
            value: control?.prefix || '{',
            type: 'control',
            color: bracketColor,
            controlId: targetControlId,
            control: imgControlObj,
            controlComponent: 'prefix',
            isPlaceholder: false
          })
          imgListNodes.forEach(item => {
            newNodes.push({
              ...baseNode,
              ...item,
              controlId: targetControlId,
              control: imgControlObj,
              controlComponent: 'value',
              isPlaceholder: false
            })
          })
          newNodes.push({
            ...baseNode,
            value: control?.postfix || '}',
            type: 'control',
            color: bracketColor,
            controlId: targetControlId,
            control: imgControlObj,
            controlComponent: 'postfix',
            isPlaceholder: false
          })
        } else {
          const imgControlObj = {
            ...control,
            type: 'list',
            listType: 'image',
            conceptId,
            placeholder: phText,
            prefix: control?.prefix || '{',
            postfix: control?.postfix || '}',
            value: null
          }
          newNodes.push({
            ...baseNode,
            value: control?.prefix || '{',
            type: 'control',
            color: bracketColor,
            controlId: targetControlId,
            control: imgControlObj,
            controlComponent: 'prefix',
            isPlaceholder: true
          })
          splitText(phText).forEach(ch => {
            newNodes.push({
              ...baseNode,
              value: ch,
              type: 'control',
              color: placeholderColor,
              controlId: targetControlId,
              control: imgControlObj,
              controlComponent: 'placeholder',
              isPlaceholder: true
            })
          })
          newNodes.push({
            ...baseNode,
            value: control?.postfix || '}',
            type: 'control',
            color: bracketColor,
            controlId: targetControlId,
            control: imgControlObj,
            controlComponent: 'postfix',
            isPlaceholder: true
          })
        }

        const firstIdx = matchingIndices[0]
        for (let m = matchingIndices.length - 1; m >= 0; m--) {
          td.value.splice(matchingIndices[m], 1)
        }
        td.value.splice(firstIdx, 0, ...newNodes)
        i = firstIdx + newNodes.length - 1
        processedControlIds.add(targetControlId)
      } else {
        processedControlIds.add(targetControlId)
        const isArrayVal = Array.isArray(val)
        const hasVal =
          val !== undefined &&
          val !== null &&
          (isArrayVal ? val.length > 0 : String(val).length > 0)

        const baseNode = td.value[matchingIndices[0]]
        const prefixChar = control?.prefix || ''
        const postfixChar = control?.postfix || ''
        const bracketColor = control?.bracketColor ?? '#000000'
        const placeholderColor = control?.placeholderColor ?? '#9c9b9b'
        const placeholderText = control?.placeholder || conceptId

        const ctrlObj = {
          type: isArrayVal ? 'list' : control?.type || 'text',
          listType: isArrayVal ? 'text' : undefined,
          conceptId,
          placeholder: placeholderText,
          prefix: prefixChar,
          postfix: postfixChar,
          bracketColor,
          placeholderColor,
          ...(control || {})
        }

        const newNodes: any[] = []

        if (isArrayVal && val.length > 0) {
          val.forEach((item: any, idx: number) => {
            if (idx > 0) {
              newNodes.push({
                ...baseNode,
                value: ' ',
                type: 'text',
                controlId: targetControlId,
                control: ctrlObj,
                controlComponent: 'value',
                isPlaceholder: false
              })
            }
            const itemStr =
              typeof item === 'object' && item !== null
                ? item.name ||
                  item.value ||
                  item.label ||
                  item.text ||
                  String(item)
                : String(item)

            newNodes.push({
              ...baseNode,
              value: prefixChar,
              type: 'text',
              color: bracketColor,
              controlId: targetControlId,
              control: ctrlObj,
              controlComponent: 'prefix',
              isPlaceholder: false
            })
            splitText(itemStr).forEach((ch: string) => {
              newNodes.push({
                ...baseNode,
                value: ch,
                type: 'text',
                color: baseNode.color,
                controlId: targetControlId,
                control: ctrlObj,
                controlComponent: 'value',
                isPlaceholder: false
              })
            })
            newNodes.push({
              ...baseNode,
              value: postfixChar,
              type: 'text',
              color: bracketColor,
              controlId: targetControlId,
              control: ctrlObj,
              controlComponent: 'postfix',
              isPlaceholder: false
            })
          })
        } else {
          const strVal = hasVal ? String(val) : ''
          newNodes.push({
            ...baseNode,
            value: prefixChar,
            type: 'text',
            color: bracketColor,
            controlId: targetControlId,
            control: ctrlObj,
            controlComponent: 'prefix',
            isPlaceholder: !hasVal
          })

          if (hasVal) {
            splitText(strVal).forEach((ch: string) => {
              newNodes.push({
                ...baseNode,
                value: ch,
                type: 'text',
                color: baseNode.color,
                controlId: targetControlId,
                control: ctrlObj,
                controlComponent: 'value',
                isPlaceholder: false
              })
            })
          } else {
            splitText(placeholderText).forEach((ch: string) => {
              newNodes.push({
                ...baseNode,
                value: ch,
                type: 'text',
                color: placeholderColor,
                controlId: targetControlId,
                control: ctrlObj,
                controlComponent: 'placeholder',
                isPlaceholder: true
              })
            })
          }

          newNodes.push({
            ...baseNode,
            value: postfixChar,
            type: 'text',
            color: bracketColor,
            controlId: targetControlId,
            control: ctrlObj,
            controlComponent: 'postfix',
            isPlaceholder: !hasVal
          })
        }

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
 * 4. 通用数据驱动全局分发引擎（统一收敛实现，直接复用 expandLoopTables 与 declaredSameMerge）
 */
export function applyGenericDataEngine(
  elementList: IElement[],
  businessData: any
): { rootValues: Array<{ conceptId: string; value: any }> } {
  const rootValues: Array<{ conceptId: string; value: any }> = []
  if (!businessData || typeof businessData !== 'object') return { rootValues }

  // 1. 基于当前元素列表展开所有循环表格
  expandLoopTables(elementList, businessData)

  // 2. 遍历并执行声明式相邻合并
  const walkMerge = (elements: IElement[]) => {
    if (!Array.isArray(elements)) return
    elements.forEach(el => {
      if (el.type === ElementType.TABLE && Array.isArray(el.trList)) {
        applyDeclaredSameMerge(el.trList)
      }
      if (Array.isArray(el.valueList)) {
        walkMerge(el.valueList)
      }
    })
  }
  walkMerge(elementList)

  return { rootValues }
}

/**
  * 对象数据转控件设值列表（递归提取各层级键值对路径与数据）
  */
export function toControlValueList(
  data: Record<string, any>,
  prefix = '',
  depth = 0
): any[] {
  if (!data || typeof data !== 'object' || depth > 10) return []
  const result: any[] = []
  Object.keys(data).forEach(key => {
    const val = data[key]
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (val === null || val === undefined) {
      result.push({ conceptId: fullPath, value: '' })
    } else if (Array.isArray(val)) {
      result.push({ conceptId: fullPath, value: val })
    } else if (typeof val === 'object') {
      result.push(...toControlValueList(val, fullPath, depth + 1))
    } else {
      result.push({ conceptId: fullPath, value: String(val) })
    }
  })
  return result
}
