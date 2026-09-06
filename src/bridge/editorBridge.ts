import { connect, WindowMessenger } from 'penpal'
import type Editor from '../editor'
import type { IBridgeOptions, IHostRpcMethods } from '../sdk/types'
import {
  getValueByPath,
  deepClone,
  getUUID,
  splitText,
  getItemValue,
  evaluateWhenCondition
} from '../editor/utils/index'
import { ZERO } from '../editor/dataset/constant/Common'
import {
  applyDeclaredSameMerge,
  renderCompositeDetailTrs,
  isImageField,
  isImageValue,
  isImageConceptName
} from '../editor/utils/dataEngine'

export { isImageField, isImageValue, isImageConceptName }

/** 轻量模板行克隆（复用不变的单元格样式属性，仅克隆动态结构与元素数组，降低 GC 压力） */
function cloneTrTemplate(tr: any): any {
  if (!tr) return tr
  const clonedTdList = Array.isArray(tr.tdList)
    ? tr.tdList.map((td: any) => ({
        ...td,
        id: getUUID(),
        value: Array.isArray(td.value) ? deepClone(td.value) : td.value
      }))
    : []
  const clonedTr = {
    ...tr,
    id: getUUID(),
    tdList: clonedTdList
  }
  delete clonedTr.loopConfig
  return clonedTr
}

/** 对象数据转控件设值列表 */
function toControlValueList(
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

/** 展开循环表格 */
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

    // 关键保护：首次遇到表格时，备份其纯净的原始模板结构 rawTrList
    // 确保无论点击多少次回显按钮，每次都是基于原始模板进行展开计算，具备绝对幂等性
    // 若处于设计模式 (isDesignMode)，重新备份当前结构
    if (!el.rawTrList || isDesignMode) {
      el.rawTrList = deepClone(el.trList)
    }

    const newTrList: any[] = []
    const trList = deepClone(el.rawTrList)

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
        const listData = getValueByPath(parentContext || businessData, datasetId)
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
          Boolean(loopConfig.isTbodyGroup) ||
          Boolean(loopConfig.isGroupHeader)

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
        if (!whenExpr || evaluateWhenCondition(whenExpr, parentContext || businessData)) {
          remapControlIdsAndCollect(tr, parentContext || businessData)
          walkTd(tr.tdList, parentContext)
          newTrList.push(tr)
        }
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





function remapControlIdsAndCollect(
  tr: any,
  itemData: any
) {
  const idMap = new Map<string, string>()

  tr.tdList.forEach((td: any) => {
    if (!Array.isArray(td.value)) return

    const processedControlIds = new Set<string>()

    // 0. 根据 when 条件过滤当前单元格内不满足条件的元素
    if (itemData) {
      td.value = td.value.filter((el: any) => {
        const when = el.when || el.control?.when
        if (!when) return true
        return evaluateWhenCondition(when, itemData)
      })
    }

    // 1. 自动容错嗅探补全缺失的 innerLoop 标记（兼容直接外部导入的 JSON 模板）
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

    // 1.4 增强同块内丢失 innerLoop 的控件节点自愈补齐（例如部分旧版保存的 JSON 中 control 节点漏打 innerLoop）
    const existingLoopConfigs: any[] = []
    td.value.forEach((el: any) => {
      if (el.innerLoop?.isLoop && el.innerLoop.datasetId) {
        if (!existingLoopConfigs.some(c => c.loopBlockId === el.innerLoop.loopBlockId)) {
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

    // 1.5 扫描并展开单元格内标签级别的 innerLoop（如 <span loop="item in list">）
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
      // 逆序展开各个循环块
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
            (itemData && typeof itemData === 'object' ? itemData[cleanKey] : undefined)
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

        // 1. 将 blk.nodes 归一化聚合为 Tokens (按 controlId 聚合同一控件的一组字符，或独立普通字符)
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

        // 2. 根据 dataRows 展开每一行数据
        dataRows.forEach((subItem: any, rowIdx: number) => {
          if (rowIdx > 0) {
            if (blk.config.isBlock !== false) {
              // 块级元素 (div/p/li/tr) 行首插入换行符 ZERO
              expandedNodes.push({ value: ZERO })
            } else {
              // 行内元素 (span) 项与项之间在同一行内以空格分隔
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
                  // 基本类型一维数组场景 (如 subItem === "重大风险")
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
                    // 当占位符写的是 {{ rule }} 或 {{ item }}，尝试取对象的常见文本属性
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

              // 1. 精准判断是否为图片（显式声明 type: image，字段名匹配图片正则，或者值本身为有效图片 URL / 对象）
              const isImg = isImageField(token.control, conceptId, subVal)

              if (isImg) {
                // 多图 / 单图列表渲染
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
                  .filter(
                    (v: string) =>
                      v && isImageValue(v)
                  )

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
                  // 无图片数据时，置灰保留占位符
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
                // 普通文本 / 数值字段：构建真实 Control 字符序列，使得回显后用户删除文字能自动退回占位符状态
                const newControlId = getUUID()
                processedControlIds.add(newControlId)
                let conceptId = token.conceptId || token.control?.conceptId || ''
                let placeholder = token.placeholder || token.control?.placeholder || ''
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

                // 前缀 {
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

                // 内容：有真实值展开真实值，无真实值展开置灰占位符
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

                // 后缀 }
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

    // 1. 刷新 Remap 其余控件 ID，确保克隆出的每一行所有字符和控件节点都拥有独立的唯一 ID
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

    // 2. 扫描并处理字段（支持单图/多图数组解包展开与文本直接回显）
    for (let i = 0; i < td.value.length; i++) {
      const el = td.value[i]
      const control = el.control
      const conceptId = control?.conceptId
      const targetControlId = el.controlId

      if (!conceptId || !itemData || !targetControlId || processedControlIds.has(targetControlId)) {
        continue
      }

      let val = getItemValue(itemData, conceptId)
      if (val === undefined && conceptId.includes('.')) {
        const cleanKey = conceptId.split('.').slice(1).join('.')
        val =
          getItemValue(itemData, cleanKey) ??
          (itemData && typeof itemData === 'object' ? itemData[cleanKey] : undefined)
      }

      // 判断是否为图片字段
      const isImgField = isImageField(control, conceptId, val)

      const matchingIndices: number[] = []
      for (let k = 0; k < td.value.length; k++) {
        if (td.value[k].controlId === targetControlId) matchingIndices.push(k)
      }
      if (matchingIndices.length === 0) continue

      if (isImgField) {
        // 多图 / 单图列表渲染
        const rawUrls =
          val !== undefined && val !== null && val !== ''
            ? Array.isArray(val)
              ? val
              : [val]
            : []
        const validImages = rawUrls
          .map((v: any) =>
            typeof v === 'object' ? v.url || v.src || String(v) : String(v)
          )
          .filter(
            (v: string) => v && isImageValue(v)
          )

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
          // 前缀 {
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
          // 图片序列
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
          // 后缀 }
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
          // 无图片数据：回退为标准置灰占位符控件
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
        // 普通文本 / 数值 / 列表字段：原地展开为标准的已填充三段式控件节点
        processedControlIds.add(targetControlId)
        const isArrayVal = Array.isArray(val)
        const hasVal =
          val !== undefined &&
          val !== null &&
          (isArrayVal ? val.length > 0 : String(val).length > 0)

        const baseNode = td.value[matchingIndices[0]]
        const prefixChar = control?.prefix ?? '{'
        const postfixChar = control?.postfix ?? '}'
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
          // 数组列表字段 (如 tags): 展开为多个分段列表项
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
                ? item.name || item.value || item.label || item.text || String(item)
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
          // 单个标量字段 (如 projectName, projectMax, score)
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
