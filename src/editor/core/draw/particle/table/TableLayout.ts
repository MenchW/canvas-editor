import { ElementType } from '../../../../dataset/enum/Element'
import { EditorMode, EditorZone } from '../../../../dataset/enum/Editor'
import { TdTextDirection } from '../../../../dataset/enum/table/Table'
import { IElement } from '../../../../interface/Element'
import { ITd } from '../../../../interface/table/Td'
import { ITr } from '../../../../interface/table/Tr'
import { IRow } from '../../../../interface/Row'
import { shrinkColgroupToWidth } from '../../../../utils/table'
import { unzipElementList } from '../../../../utils/element'
import { TableParticle } from './TableParticle'
import { Draw } from '../../Draw'

export function getTdFingerprint(td: ITd, mode?: EditorMode, tr?: ITr): string {
  const val = td.value
  const len = val ? val.length : 0
  const vAlign = td.verticalAlign || ''
  const textDir = td.textDirection || ''
  const trH = tr ? `${tr.height || ''}_${tr.minHeight || ''}` : ''
  if (len === 0) return `0_${mode || ''}_${vAlign}_${textDir}_${trH}`
  let imgDims = ''
  let layoutHash = 0
  for (let i = 0; i < len; i++) {
    const el = val[i]
    if (el?.type === ElementType.IMAGE) {
      imgDims += `_img${i}:${el.width}x${el.height}`
    }
    if (el) {
      const sz = el.size || 0
      const rf = el.rowFlex
      const rm = el.rowMargin
      const lt = el.listType
      const ls = el.listStyle
      layoutHash = ((layoutHash << 5) - layoutHash + sz) | 0
      if (rf) layoutHash = ((layoutHash << 5) - layoutHash + rf.charCodeAt(0)) | 0
      if (rm) layoutHash = ((layoutHash << 5) - layoutHash + ((rm * 10) | 0)) | 0
      if (lt) layoutHash = ((layoutHash << 5) - layoutHash + lt.charCodeAt(0)) | 0
      if (ls) layoutHash = ((layoutHash << 5) - layoutHash + (ls ? String(ls).charCodeAt(0) : 0)) | 0
    }
  }
  if (len === 1) {
    return `1_${val[0].value || ''}_${val[0].size || ''}_${mode || ''}_${vAlign}_${textDir}_${trH}_${layoutHash}${imgDims}`
  }
  const mid = len >> 1
  return `${len}_${val[0]?.value || ''}_${val[mid]?.value || ''}_${val[len - 1]?.value || ''}_${val[0]?.size || ''}_${mode || ''}_${vAlign}_${textDir}_${trH}_${layoutHash}${imgDims}`
}

export interface ITableComputeContext {
  element: IElement
  scale: number
  defaultSize: number
  rowMargin: number
  tdPadding: [number, number, number, number]
  defaultColMinWidth: number
  overflow: boolean
  mode: EditorMode
  isPagingMode: boolean
  getOriginalInnerWidth: () => number
  computeRowList: (payload: {
    innerWidth: number
    elementList: IElement[]
    isFromTable?: boolean
    isPagingMode?: boolean
    textDirection?: any
  }) => IRow[]
}

export class TableLayout {
  private draw: Draw
  private tableParticle: TableParticle

  constructor(draw: Draw) {
    this.draw = draw
    this.tableParticle = draw.getTableParticle()
  }

  // 表格全量排版流水线：列宽限制、单元格排版与缓存比对、四轮自适应行高推导与几何尺寸同步
  public computeTableLayout(ctx: ITableComputeContext): { width: number; height: number } {
    const {
      element,
      scale,
      defaultSize,
      rowMargin,
      tdPadding,
      defaultColMinWidth,
      overflow,
      mode,
      isPagingMode,
      getOriginalInnerWidth,
      computeRowList
    } = ctx

    const tdPaddingWidth = tdPadding[1] + tdPadding[3]
    const tdPaddingHeight = tdPadding[0] + tdPadding[2]
    const trList = element.trList!

    // 表格不允许超出正文区域时：等比例压缩列宽至内容区内，并清除横向偏移
    if (!overflow) {
      shrinkColgroupToWidth(
        element.colgroup!,
        getOriginalInnerWidth(),
        defaultColMinWidth
      )
      element.translateX = 0
    }

    // 初次排版或尚未初始化几何信息时计算行列
    const isFirstTableLayout = !element.height
    if (isFirstTableLayout) {
      this.tableParticle.computeRowColInfo(element)
    }
    const tdMinHeight =
      tdPaddingHeight + defaultSize + (rowMargin * 2) / scale

    // 1. 计算表格内各单元格内容排版与实际内容高度（仅对脏单元格计算）
    let hasAnyTdHeightChanged = isFirstTableLayout
    for (let t = 0; t < trList.length; t++) {
      const tr = trList[t]
      if (
        (tr as any)._lastMinHeight !== tr.minHeight ||
        (tr as any)._lastHeight !== tr.height
      ) {
        hasAnyTdHeightChanged = true
        ;(tr as any)._lastMinHeight = tr.minHeight
        ;(tr as any)._lastHeight = tr.height
      }
      for (let d = 0; d < tr.tdList.length; d++) {
        const td = tr.tdList[d]
        const curValue = td.value
        const curFingerprint = getTdFingerprint(td, mode, tr)

        const curTextDir = td.textDirection || TdTextDirection.HORIZONTAL
        // 极速短路：单元格排版结果存在且特征指纹、模式、宽度、缩放、文字方向完全一致时直接复用
        if (
          td.rowList &&
          td.mainHeight !== undefined &&
          (td as any)._lastFingerprint === curFingerprint &&
          (td as any)._lastMode === mode &&
          (td as any)._lastWidth === td.width &&
          ((td as any)._lastScale === undefined || (td as any)._lastScale === scale) &&
          (td as any)._lastTextDir === curTextDir
        ) {
          ;(td as any)._lastScale = scale
          ;(td as any)._lastTextDir = curTextDir
          continue
        }

        if (curValue?.length && !(td as any)._isUnzipped) {
          const hasLongText = curValue.some(
            el =>
              el.type !== ElementType.IMAGE &&
              el.type !== ElementType.LATEX &&
              el.type !== ElementType.SEPARATOR &&
              el.type !== ElementType.TABLE &&
              el.value &&
              el.value.length > 1
          )
          if (hasLongText) {
            td.value = unzipElementList(curValue)
            td.value.forEach(el => {
              el.tdId = td.id
              el.trId = tr.id
              el.tableId = element.id
            })
          }
          ;(td as any)._isUnzipped = true
        }

        const targetInnerWidth = (td.width! - tdPaddingWidth) * scale
        const rowList = computeRowList({
          innerWidth: targetInnerWidth,
          elementList: td.value,
          isFromTable: true,
          isPagingMode,
          textDirection: td.textDirection
        })
        if (td.textDirection === TdTextDirection.VERTICAL) {
          console.log('[Table TextDirection] 竖排单元格重新排版完成: 行数 =', rowList.length, '内容 =', td.value?.map(v => v.value).join(''))
        }
        const rowHeight = rowList.reduce((pre, cur) => pre + cur.height, 0)
        td.rowList = rowList
        const extraPadding =
          rowList.length > 1 ? Math.max(12, rowList.length * 2 + 8) : 0
        const curTdHeight =
          Math.ceil(rowHeight / scale + tdPaddingHeight + extraPadding)

        if (td.mainHeight !== curTdHeight) {
          hasAnyTdHeightChanged = true
        }
        td.mainHeight = curTdHeight

        // 记录排版指纹
        ;(td as any)._lastFingerprint = curFingerprint
        ;(td as any)._lastMode = mode
        ;(td as any)._lastValue = td.value
        ;(td as any)._lastLen = td.value?.length || 0
        ;(td as any)._lastWidth = td.width
        ;(td as any)._lastScale = scale
        ;(td as any)._lastTextDir = curTextDir
      }
    }

    // 2~4. 自适应推导：仅在初次排版或有单元格内容高度/行高发生变动时执行
    if (hasAnyTdHeightChanged) {
      // 2. 第一轮自适应：由单行单元格（rowspan === 1）的最大内容高度确定各行高度
      for (let t = 0; t < trList.length; t++) {
        const tr = trList[t]
        let maxSingleHeight = Math.max(tdMinHeight, tr.minHeight || 0)
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          if (td.rowspan === 1) {
            maxSingleHeight = Math.max(maxSingleHeight, td.mainHeight || 0)
          }
        }
        tr.height = maxSingleHeight
        ;(tr as any)._lastMinHeight = tr.minHeight
      }

      // 3. 第二轮自适应：由跨行合并单元格（rowspan > 1）补齐高度差额
      for (let t = 0; t < trList.length; t++) {
        const tr = trList[t]
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          if (td.rowspan > 1) {
            let spannedHeight = 0
            for (let r = 0; r < td.rowspan; r++) {
              spannedHeight += (trList[t + r] || tr).height
            }
            if (spannedHeight < td.mainHeight!) {
              const diff = td.mainHeight! - spannedHeight
              const lastTr = trList[t + td.rowspan - 1] || tr
              lastTr.height += diff
            }
          }
        }
      }

      // 4. 最终同步每个单元格的 height 与 realHeight
      for (let t = 0; t < trList.length; t++) {
        const tr = trList[t]
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          let totalHeight = 0
          let totalMinHeight = 0
          for (let r = 0; r < td.rowspan; r++) {
            const curTr = trList[t + r] || tr
            totalHeight += curTr.height
            totalMinHeight += curTr.minHeight || tdMinHeight
          }
          td.height = totalHeight
          td.realHeight = totalHeight
          td.realMinHeight = totalMinHeight
        }
      }
      // 重新同步表格行列几何信息
      this.tableParticle.computeRowColInfo(element)
    }

    // 计算出表格整体尺寸并写回
    const tableHeight = this.tableParticle.getTableHeight(element)
    const tableWidth = this.tableParticle.getTableWidth(element)
    element.width = tableWidth
    element.height = tableHeight

    return {
      width: tableWidth * scale,
      height: tableHeight * scale
    }
  }

  // 拼音合成（IME Composing）期单单元格快速局部排版
  public tryFastLayoutCell(payload: {
    curIndex?: number
    isSetCursor?: boolean
  }): boolean {
    const positionContext = this.draw.getPosition().getPositionContext()
    if (!positionContext.isTable || payload.curIndex === undefined) {
      return false
    }
    const originalElementList = this.draw.getOriginalElementList()
    const td = this.draw.getPosition().getTableTdByContext(originalElementList, positionContext)
    const tableElement = this.draw.getPosition().getTableElementByContext(originalElementList, positionContext)
    if (!td || !tableElement) return false

    const scale = this.draw.getOptions().scale
    const tdPadding = this.draw.getOptions().table.tdPadding
    const tdPaddingWidth = tdPadding[1] + tdPadding[3]
    const targetInnerWidth = (td.width! - tdPaddingWidth) * scale
    const rowList = this.draw.computeRowList({
      innerWidth: targetInnerWidth,
      elementList: td.value,
      isFromTable: true,
      isPagingMode: false,
      textDirection: td.textDirection
    })
    const rowHeight = rowList.reduce((pre, cur) => pre + cur.height, 0)
    const tdPaddingHeight = tdPadding[0] + tdPadding[2]
    const extraPadding = rowList.length > 1 ? Math.max(12, rowList.length * 2 + 8) : 0
    const curTdHeight = Math.ceil(rowHeight / scale + tdPaddingHeight + extraPadding)

    // 仅在单元格高度未超出既有行高度时走局部极速渲染（绝大多数输入场景）
    if (curTdHeight <= (td.realHeight || td.height || 0)) {
      td.rowList = rowList
      const curTr =
        tableElement.trList && positionContext.trIndex !== undefined
          ? tableElement.trList[positionContext.trIndex]
          : undefined
      const curFp = getTdFingerprint(td, this.draw.getMode(), curTr)
      ;(td as any)._lastFingerprint = curFp
      ;(td as any)._lastMode = this.draw.getMode()
      ;(td as any)._lastValue = td.value
      ;(td as any)._lastLen = td.value?.length || 0
      ;(td as any)._lastWidth = td.width
      ;(td as any)._lastScale = scale
      ;(td as any)._lastTextDir = td.textDirection

      const cursorPosition = this.draw.getPosition().getCursorPosition()
      const curPageNo = cursorPosition ? cursorPosition.pageNo : this.draw.getPageNo()
      const curStartX = (td as any)._posStartX || 0
      const curStartY = (td as any)._posStartY || 0
      td.positionList = []
      this.draw.getPosition().computePageRowPosition({
        positionList: td.positionList,
        rowList,
        pageNo: curPageNo,
        startRowIndex: 0,
        startIndex: 0,
        startX: curStartX,
        startY: curStartY,
        innerWidth: targetInnerWidth,
        isTable: true,
        index: (positionContext.index || 1) - 1,
        tdIndex: td.tdIndex!,
        trIndex: td.rowIndex!,
        zone: EditorZone.MAIN
      })
      const visibleTdHeight = (td.realHeight || td.height || 0) * scale
      this.draw.getPosition().offsetTdPositionByVerticalAlign(td, td.positionList, visibleTdHeight)
      ;(td as any)._posRowList = rowList
      ;(td as any)._posTdHeight = visibleTdHeight

      // 重绘当前页
      const pageRowList = this.draw.getPageRowList()
      if (pageRowList[curPageNo]) {
        this.draw._drawPage({
          elementList: this.draw.getOriginalMainElementList(),
          positionList: this.draw.getPosition().getOriginalMainPositionList(),
          rowList: pageRowList[curPageNo],
          pageNo: curPageNo
        })
      }

      // 光标重绘
      if (payload.isSetCursor) {
        this.draw.setCursor(payload.curIndex)
      }
      return true
    }
    return false
  }
}
