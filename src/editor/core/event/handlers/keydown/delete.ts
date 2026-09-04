import { ZERO } from '../../../../dataset/constant/Common'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { EditorMode } from '../../../../dataset/enum/Editor'
import { ElementType } from '../../../../dataset/enum/Element'
import { IElement } from '../../../../interface/Element'
import { CanvasEvent } from '../../CanvasEvent'

// 删除光标后隐藏元素，跳过留痕删除元素（痕迹不可移除）
function deleteHideElement(host: CanvasEvent) {
  const draw = host.getDraw()
  const traceParticle = draw.getTraceParticle()
  const rangeManager = draw.getRange()
  const range = rangeManager.getRange()
  // 光标后一个元素为隐藏/留痕删除元素时触发循环
  const elementList = draw.getElementList()
  let index = range.startIndex + 1
  const element = elementList[index]
  if (
    !element ||
    (!element.hide &&
      !element.control?.hide &&
      !element.area?.hide &&
      !traceParticle.isTraceHidden(element))
  ) {
    return
  }
  // 向后跳过隐藏/留痕删除元素（隐藏元素直接删除，留痕删除元素仅移动光标）
  let hasValidTarget = false
  while (index < elementList.length) {
    const element = elementList[index]
    const isHide = element.hide || element.control?.hide || element.area?.hide
    const isTraceHidden = traceParticle.isTraceHidden(element)
    if (!isHide && !isTraceHidden) {
      hasValidTarget = true
      break
    }
    let newIndex: number | null
    if (isHide) {
      // 隐藏元素直接删除
      if (element.controlId) {
        newIndex = draw.getControl().removeControl(index)
      } else {
        draw.spliceElementList(elementList, index, 1)
        newIndex = index
      }
    } else {
      // 留痕删除元素仅移动光标：控件整体跳过
      if (element.controlId) {
        newIndex =
          draw
            .getControl()
            .getControlEndIndex(elementList, index, element.controlId!) + 1
      } else {
        newIndex = index + 1
      }
    }
    if (newIndex === null || newIndex >= elementList.length) break
    index = newIndex
  }
  // 更新上下文信息
  if (hasValidTarget && index > range.startIndex + 1) {
    range.startIndex = index - 1
    range.endIndex = index - 1
    rangeManager.replaceRange(range)
    // 更新位置信息
    const position = draw.getPosition()
    const positionList = position.getPositionList()
    position.setCursorPosition(positionList[index - 1])
  }
}

export function del(evt: KeyboardEvent, host: CanvasEvent) {
  const draw = host.getDraw()
  if (draw.isReadonly()) return
  const rangeManager = draw.getRange()
  const control = draw.getControl()
  const elementList = draw.getElementList()

  // 可输入性验证
  if (!rangeManager.getIsCanInput()) return

  const { isCrossRowCol } = rangeManager.getRange()
  let { startIndex, endIndex } = rangeManager.getRange()
  const isCollapsed = rangeManager.getIsCollapsed()

  // 1. 优先长选区直接安全删除（跨行、跨控件、Ctrl+A 全选清空）
  if (!isCollapsed) {
    console.log('%c[Delete] Branch 1: Long Selection Delete', 'color: #009688; font-weight: bold')
    draw.getPreviewer().clearResizer()
    const curIndex = control.cleanSelectionDelete(
      elementList,
      startIndex,
      endIndex
    )
    rangeManager.setRange(curIndex, curIndex)
    draw.render({ curIndex, isSubmitHistoryDebounce: true })
    draw.getGlobalEvent().setCanvasEventAbility()
    return
  }

  // 2. 选区折叠态下，检查 Previewer 独立选中图片（支持多图列表控件单张删除）
  const previewCurElement = draw.getPreviewer().getCurElement()
  if (previewCurElement && draw.getPreviewer().getIsResizerVisible()) {
    console.log('%c[Delete] Branch 2: Previewer Resizer Image Delete', 'color: #009688; font-weight: bold')
    draw.getPreviewer().clearResizer()
    let targetList = elementList
    let hitIdx = targetList.indexOf(previewCurElement)
    if (hitIdx === -1 && previewCurElement.id) {
      hitIdx = targetList.findIndex(el => el.id === previewCurElement.id)
    }
    if (hitIdx === -1 && previewCurElement.value) {
      hitIdx = targetList.findIndex(
        el =>
          el.controlId === previewCurElement.controlId &&
          el.value === previewCurElement.value
      )
    }
    // 若在当前上下文列表中未找到，则在全表单元格中检索该图片
    if (hitIdx === -1) {
      const originalEl = draw.getOriginalElementList()
      outer: for (let i = 0; i < originalEl.length; i++) {
        const item = originalEl[i]
        if (item.type === ElementType.TABLE && item.trList) {
          for (let r = 0; r < item.trList.length; r++) {
            const tr = item.trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              const tdVal = td.value || []
              let idx = tdVal.indexOf(previewCurElement)
              if (idx === -1 && previewCurElement.id) {
                idx = tdVal.findIndex(el => el.id === previewCurElement.id)
              }
              if (idx === -1 && previewCurElement.value) {
                idx = tdVal.findIndex(
                  el =>
                    el.controlId === previewCurElement.controlId &&
                    el.value === previewCurElement.value
                )
              }
              if (idx !== -1) {
                targetList = tdVal
                hitIdx = idx
                draw.getPosition().setPositionContext({
                  isTable: true,
                  index: i,
                  trIndex: r,
                  tdIndex: d,
                  tdId: td.id,
                  trId: tr.id,
                  tableId: item.id
                })
                break outer
              }
            }
          }
        }
      }
    }

    if (hitIdx !== -1) {
      draw.flushHistory()
      const cId = previewCurElement.controlId
      const isList =
        previewCurElement.control?.listType === 'image' ||
        Boolean(previewCurElement.control?.listType)
      if (cId && isList) {
        // 多图控件：只删除当前被点击选中的这一张图片
        draw.deleteElementList(targetList, hitIdx, 1)
        if (
          targetList[hitIdx]?.value === '  ' ||
          targetList[hitIdx]?.value === ZERO
        ) {
          draw.deleteElementList(targetList, hitIdx, 1)
        }
        const remainImages: IElement[] = []
        for (let i = 0; i < targetList.length; i++) {
          if (
            targetList[i]?.controlId === cId &&
            targetList[i]?.type === ElementType.IMAGE
          ) {
            remainImages.push(targetList[i])
          }
        }
        const cleanImages: IElement[] = remainImages.map(img => {
          const copy = { ...img }
          delete copy.control
          delete copy.controlComponent
          delete copy.controlId
          return copy
        })
        for (let i = 0; i < targetList.length; i++) {
          const item = targetList[i]
          if (item?.controlId === cId && item.control) {
            item.control.value = cleanImages
          }
        }
        if (remainImages.length === 0) {
          if (draw.getMode() === EditorMode.PREVIEW_EDIT) {
            control.removeControl(hitIdx, { elementList: targetList })
          } else {
            control.addPlaceholder(Math.max(0, hitIdx - 1), {
              elementList: targetList
            })
          }
        }
      } else if (cId) {
        control.removeControl(hitIdx, { elementList: targetList })
      } else {
        draw.deleteElementList(targetList, hitIdx, 1)
      }
      const newIndex = Math.max(0, hitIdx - 1)
      rangeManager.setRange(newIndex, newIndex)
      draw.render({ curIndex: newIndex, isSubmitHistory: true })
    }
    return
  }

  // 3. 隐藏控件删除 / 跳过留痕删除元素
  deleteHideElement(host)
  const range = rangeManager.getRange()
  startIndex = range.startIndex
  endIndex = range.endIndex

  // 4. 表格跨行列删除
  if (isCrossRowCol) {
    const rowCol = draw.getTableParticle().getRangeRowCol()
    if (!rowCol) return
    let isDeleted = false
    for (let r = 0; r < rowCol.length; r++) {
      const row = rowCol[r]
      for (let c = 0; c < row.length; c++) {
        const col = row[c]
        if (col.value.length > 1) {
          draw.deleteElementList(col.value, 1, col.value.length - 1, {
            tdDeletable: col.deletable !== false
          })
          isDeleted = true
        }
      }
    }
    const curIndex = isDeleted ? 0 : null
    draw.getGlobalEvent().setCanvasEventAbility()
    if (curIndex === null) {
      rangeManager.setRange(startIndex, startIndex)
      draw.render({ curIndex: startIndex, isSubmitHistory: false })
    } else {
      rangeManager.setRange(curIndex, curIndex)
      draw.render({ curIndex })
    }
    return
  }

  // 5. 控件内部事件捕获
  if (control.getActiveControl() && control.getIsRangeWithinControl()) {
    const curIndex = control.keydown(evt)
    if (curIndex !== null) {
      control.emitControlContentChange()
      rangeManager.setRange(curIndex, curIndex)
      draw.render({
        curIndex,
        isSubmitHistoryDebounce: true
      })
      draw.getGlobalEvent().setCanvasEventAbility()
      return
    }
  }

  if (
    !draw.isReadonly() &&
    draw.getMode() !== EditorMode.PREVIEW_EDIT &&
    elementList[endIndex + 1]?.controlId
  ) {
    const curIndex = control.removeControl(endIndex + 1)
    draw.getGlobalEvent().setCanvasEventAbility()
    if (curIndex !== null) {
      rangeManager.setRange(curIndex, curIndex)
      draw.render({ curIndex })
    }
    return
  }

  // 6. 普通闭合光标元素 Delete 前向删除
  draw.getPreviewer().clearResizer()
  const isPreviewEdit = draw.getMode() === EditorMode.PREVIEW_EDIT
  const position = draw.getPosition()
  const cursorPosition = position.getCursorPosition()
  if (!cursorPosition) return
  const { index } = cursorPosition

  let curIndex: number | null = null
  const positionContext = position.getPositionContext()
  if (positionContext.isDirectHit && positionContext.isImage) {
    if (elementList[index]?.controlId) {
      curIndex = control.removeControl(index)
    } else {
      draw.deleteElementList(elementList, index, 1)
      curIndex = index - 1
    }
  } else {
    if (!elementList[index + 1]) return
    const nextElement = elementList[index + 1]
    const nextCId = nextElement.controlId

    if (
      nextElement.controlComponent === ControlComponent.PREFIX ||
      nextElement.controlComponent === ControlComponent.PRE_TEXT ||
      nextElement.controlComponent === ControlComponent.PLACEHOLDER ||
      nextElement.controlComponent === ControlComponent.POSTFIX ||
      nextElement.controlComponent === ControlComponent.POST_TEXT
    ) {
      curIndex = control.removeControl(index + 1)
    } else if (nextCId && nextElement.controlComponent === ControlComponent.VALUE) {
      // 控件内单字前向删除
      draw.deleteElementList(elementList, index + 1, 1)
      let hasRemainValue = false
      for (let i = 0; i < elementList.length; i++) {
        if (
          elementList[i]?.controlId === nextCId &&
          (elementList[i]?.controlComponent === ControlComponent.VALUE ||
            elementList[i]?.controlComponent === ControlComponent.CHECKBOX ||
            elementList[i]?.controlComponent === ControlComponent.RADIO)
        ) {
          hasRemainValue = true
          break
        }
      }
      if (!hasRemainValue) {
        if (isPreviewEdit) {
          curIndex = control.removeControl(index)
        } else {
          control.addPlaceholder(index)
          curIndex = index
        }
      } else {
        curIndex = index
      }
    } else {
      if (index + 1 < elementList.length) {
        draw.deleteElementList(elementList, index + 1, 1)
        curIndex = index
      } else {
        curIndex = index
      }
    }
  }

  draw.getGlobalEvent().setCanvasEventAbility()
  if (curIndex === null) {
    rangeManager.setRange(startIndex, startIndex)
    draw.render({
      curIndex: startIndex,
      isSubmitHistory: false
    })
  } else {
    rangeManager.setRange(curIndex, curIndex)
    draw.render({
      curIndex,
      isSubmitHistoryDebounce: true
    })
  }
}
