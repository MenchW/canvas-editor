import { VerticalAlign } from '../../../../dataset/enum/VerticalAlign'
import { EditorZone } from '../../../../dataset/enum/Editor'
import { TdTextDirection } from '../../../../dataset/enum/table/Table'
import { IElement } from '../../../../interface/Element'
import { IElementPosition } from '../../../../interface/Element'
import { IRow } from '../../../../interface/Row'
import { ITd } from '../../../../interface/table/Td'
import { Position } from '../../../position/Position'
import { Draw } from '../../Draw'

export interface ITablePositionPayload {
  element: IElement
  curRow: IRow
  index: number
  pageNo: number
  tablePreX: number
  tablePreY: number
  positionItem: IElementPosition
  zone?: EditorZone
}

export class TablePositioner {
  private draw: Draw
  private position: Position
  private repeatHeaderTemplateMap: WeakMap<
    IElement,
    {
      basePreX: number
      basePreY: number
      list: Array<{ td: ITd; positionList: IElementPosition[] }>
    }
  >

  constructor(draw: Draw, position: Position) {
    this.draw = draw
    this.position = position
    this.repeatHeaderTemplateMap = new WeakMap()
  }

  public clearCache(): void {
    this.repeatHeaderTemplateMap = new WeakMap()
  }

  // 单元格内容按垂直对齐方式偏移位置（未显式声明时默认顶端对齐 TOP）
  public offsetTdPositionByVerticalAlign(
    td: ITd,
    positionList: IElementPosition[],
    customTdHeight?: number
  ): void {
    if (!td.rowList?.length || !positionList?.length) return
    const verticalAlign = td.verticalAlign || VerticalAlign.TOP
    if (
      verticalAlign !== VerticalAlign.MIDDLE &&
      verticalAlign !== VerticalAlign.BOTTOM
    ) {
      return
    }
    const {
      scale,
      table: { tdPadding }
    } = this.draw.getOptions()
    const tdPaddingTop = tdPadding[0] * scale
    const tdPaddingBottom = tdPadding[2] * scale
    const rowsHeight = td.rowList.reduce((pre, cur) => pre + cur.height, 0)
    const tdHeight =
      customTdHeight !== undefined
        ? customTdHeight
        : (td.realHeight || td.height!) * scale
    const maxAvailableContentHeight = Math.max(
      0,
      tdHeight - tdPaddingTop - tdPaddingBottom
    )
    const blankHeight = maxAvailableContentHeight - rowsHeight
    if (blankHeight <= 1) return

    const targetOffset =
      verticalAlign === VerticalAlign.MIDDLE ? blankHeight / 2 : blankHeight
    const safeOffset = Math.min(targetOffset, blankHeight)

    if (Math.floor(safeOffset) > 0) {
      positionList.forEach(tdPosition => {
        const {
          coordinate: { leftTop, leftBottom, rightBottom, rightTop }
        } = tdPosition
        leftTop[1] += safeOffset
        leftBottom[1] += safeOffset
        rightBottom[1] += safeOffset
        rightTop[1] += safeOffset
      })
    }
  }

  // 计算表格单元格及内部元素在当前行片段/当前页中的具体坐标
  public computeTablePositions(payload: ITablePositionPayload): void {
    const {
      element,
      curRow,
      index,
      pageNo,
      tablePreX,
      tablePreY,
      positionItem,
      zone
    } = payload

    const {
      scale,
      table: { tdPadding }
    } = this.draw.getOptions()
    const tdPaddingWidth = tdPadding[1] + tdPadding[3]
    const tableFragment = curRow.tableFragment
    const tableParticle = this.draw.getTableParticle()

    // 遍历片段范围行与进位合并单元格，按窗口计算位置（跨页按页累积）
    const fragmentTdList = tableFragment
      ? tableParticle.getFragmentTdList(element, tableFragment)
      : element.trList!.flatMap(tr => tr.tdList)

    for (const td of fragmentTdList) {
      let isSplitWindow = false
      let isContinuation = false
      let windowStart = 0
      let windowEnd = td.height!
      if (tableFragment) {
        ;[windowStart, windowEnd] = tableParticle.getTdWindowInFragment(
          td,
          element,
          tableFragment
        )
        if (windowEnd <= windowStart) continue
        isSplitWindow = windowStart > 0 || windowEnd < td.height!
        isContinuation = windowStart > 0
      }
      // 拆分窗口：本片段仅计算窗口内的内容行位置
      let rowList = td.rowList!
      let startIndex = 0
      let startRowIndex = 0
      if (isSplitWindow) {
        const visible = tableParticle.getTdVisibleRowListByWindow(
          td,
          windowStart,
          windowEnd
        )
        rowList = visible.rowList
        startIndex = visible.startIndex
        startRowIndex = visible.startRowIndex
      }
      // 片段内单元格内容纵坐标偏移（窗口顶部在片段内的位置）
      const drawnOffsetY = tableFragment
        ? tableParticle.getTdWindowOffsetY(windowStart, tableFragment)
        : 0
      const curStartX =
        (td.x! + tdPadding[3]) * scale +
        tablePreX +
        (element.translateX || 0) * scale
      const curStartY =
        (td.y! + tdPadding[0]) * scale + tablePreY + drawnOffsetY

      const visibleTdHeight = tableFragment
        ? (windowEnd - windowStart) * scale
        : (td.realHeight || td.height!) * scale

      // 单元格位置列表缓存复用：未跨页分窗、绝对坐标未变、排版行未变、对齐方式未变、文字方向未变、高度未变时直接复用
      const currentVAlign = td.verticalAlign || VerticalAlign.TOP
      const currentTextDir = td.textDirection || TdTextDirection.HORIZONTAL
      const isCanReusePosition =
        !isSplitWindow &&
        !isContinuation &&
        Array.isArray(td.positionList) &&
        td.positionList.length > 0 &&
        (td as any)._posStartX === curStartX &&
        (td as any)._posStartY === curStartY &&
        (td as any)._posPageNo === pageNo &&
        (td as any)._posRowList === rowList &&
        (td as any)._posVAlign === currentVAlign &&
        (td as any)._posTextDir === currentTextDir &&
        (td as any)._posTdHeight === visibleTdHeight

      if (!isCanReusePosition) {
        if (!Array.isArray(td.positionList) || !isContinuation) {
          td.positionList = []
        }
        const tdPositionList = td.positionList
        this.position.computePageRowPosition({
          positionList: tdPositionList,
          rowList,
          pageNo,
          startRowIndex,
          startIndex,
          startX: curStartX,
          startY: curStartY,
          innerWidth: (td.width! - tdPaddingWidth) * scale,
          isTable: true,
          index: index - 1,
          tdIndex: td.tdIndex!,
          trIndex: td.rowIndex!,
          zone,
          tablePosition: positionItem
        })
        // 垂直对齐方式：
        // 1. 未发生跨页拆分窗口的普通单元格；
        // 2. 虽处于跨页拆分片段，但本单元格的所有内容行完整容纳在当前片段内（未发生跨页内容截断）
        const isContentFullyContained =
          !isSplitWindow ||
          (startRowIndex === 0 &&
            rowList.length === (td.rowList?.length || 0))
        if (isContentFullyContained) {
          this.offsetTdPositionByVerticalAlign(
            td,
            tdPositionList,
            visibleTdHeight
          )
        }
        ;(td as any)._posStartX = curStartX
        ;(td as any)._posStartY = curStartY
        ;(td as any)._posPageNo = pageNo
        ;(td as any)._posRowList = rowList
        ;(td as any)._posVAlign = currentVAlign
        ;(td as any)._posTextDir = currentTextDir
        ;(td as any)._posTdHeight = visibleTdHeight
      }
    }

    // 续页回显表头：仅用于绘制的一次性位置，不参与命中
    if (tableFragment?.repeatTrIndexes?.length) {
      curRow.repeatTdPositionList = []
      const cachedTemplate = this.repeatHeaderTemplateMap.get(element)
      if (cachedTemplate) {
        const deltaX = tablePreX - cachedTemplate.basePreX
        const deltaY = tablePreY - cachedTemplate.basePreY
        for (let c = 0; c < cachedTemplate.list.length; c++) {
          const item = cachedTemplate.list[c]
          const clonedPositions: IElementPosition[] = new Array(
            item.positionList.length
          )
          for (let p = 0; p < item.positionList.length; p++) {
            const orig = item.positionList[p]
            const { leftTop, rightTop, leftBottom, rightBottom } =
              orig.coordinate
            clonedPositions[p] = {
              ...orig,
              pageNo,
              coordinate: {
                leftTop: [leftTop[0] + deltaX, leftTop[1] + deltaY],
                rightTop: [rightTop[0] + deltaX, rightTop[1] + deltaY],
                leftBottom: [leftBottom[0] + deltaX, leftBottom[1] + deltaY],
                rightBottom: [rightBottom[0] + deltaX, rightBottom[1] + deltaY]
              }
            }
          }
          curRow.repeatTdPositionList.push({
            td: item.td,
            positionList: clonedPositions
          })
        }
      } else {
        const templateList: Array<{
          td: ITd
          positionList: IElementPosition[]
        }> = []
        let repeatAccHeight = 0
        for (const trIndex of tableFragment.repeatTrIndexes) {
          const tr = element.trList![trIndex]
          for (let d = 0; d < tr.tdList.length; d++) {
            const td = tr.tdList[d]
            const positionList: IElementPosition[] = []
            const startX =
              (td.x! + tdPadding[3]) * scale +
              tablePreX +
              (element.translateX || 0) * scale
            const startY =
              (repeatAccHeight + tdPadding[0]) * scale + tablePreY
            this.position.computePageRowPosition({
              positionList,
              rowList: td.rowList!,
              pageNo,
              startRowIndex: 0,
              startIndex: 0,
              startX,
              startY,
              innerWidth: (td.width! - tdPaddingWidth) * scale,
              isTable: true,
              index: index - 1,
              tdIndex: d,
              trIndex,
              zone,
              tablePosition: positionItem
            })
            this.offsetTdPositionByVerticalAlign(td, positionList)
            templateList.push({ td, positionList })
            curRow.repeatTdPositionList.push({ td, positionList })
          }
          repeatAccHeight += tr.height!
        }
        this.repeatHeaderTemplateMap.set(element, {
          basePreX: tablePreX,
          basePreY: tablePreY,
          list: templateList
        })
      }
    }
  }
}
