import { ZERO } from '../../../../dataset/constant/Common'
import { ControlComponent, ControlType } from '../../../../dataset/enum/Control'
import { EditorMode } from '../../../../dataset/enum/Editor'
import { ElementType } from '../../../../dataset/enum/Element'
import { IElement } from '../../../../interface/Element'
import { CanvasEvent } from '../../CanvasEvent'

// 删除光标前隐藏元素，跳过留痕删除元素（痕迹不可移除）
function backspaceHideElement(host: CanvasEvent) {
  const draw = host.getDraw()
  const traceParticle = draw.getTraceParticle()
  const rangeManager = draw.getRange()
  const range = rangeManager.getRange()
  // 光标所在位置为隐藏/留痕删除元素时触发循环
  const elementList = draw.getElementList()
  let index = range.startIndex
  const element = elementList[index]
  // 控件的前后缀与内容是合法的控件结构，严禁当作隐藏垃圾元素自动销毁
  if (element?.controlComponent || (element?.controlId && !element.hide)) {
    return
  }
  if (
    !element ||
    (!element.hide &&
      !element.control?.hide &&
      !element.area?.hide &&
      !traceParticle.isTraceHidden(element))
  ) {
    return
  }
  // 向前跳过隐藏/留痕删除元素（隐藏元素直接删除，留痕删除元素仅移动光标）
  let hasValidTarget = false
  while (index > 0) {
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
        newIndex = index - 1
      }
    } else {
      // 留痕删除元素仅移动光标：控件整体跳过
      if (element.controlId) {
        newIndex =
          draw
            .getControl()
            .getControlStartIndex(elementList, index, element.controlId!) - 1
      } else {
        newIndex = index - 1
      }
    }
    if (newIndex === null || newIndex < 0) break
    index = newIndex
  }
  // 更新上下文信息
  if (hasValidTarget && index !== range.startIndex) {
    range.startIndex = index
    range.endIndex = index
    rangeManager.replaceRange(range)
    // 更新位置信息
    const position = draw.getPosition()
    const positionList = position.getPositionList()
    position.setCursorPosition(positionList[index])
  }
}

export function backspace(evt: KeyboardEvent, host: CanvasEvent) {
  const draw = host.getDraw()
  if (draw.isReadonly()) return
  const rangeManager = draw.getRange()
  const control = draw.getControl()
  const elementList = draw.getElementList()

  // 可输入性验证
  if (!rangeManager.getIsCanInput()) return

  const { startIndex, endIndex, isCrossRowCol } = rangeManager.getRange()
  const isCollapsed = rangeManager.getIsCollapsed()

  // 1. 优先长选区直接删除（跨行、跨控件、Ctrl+A 全选安全清空）
  if (!isCollapsed) {
    console.log('%c[Backspace] Branch 1: Long Selection Delete', 'color: #009688; font-weight: bold')
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
  const previewer = draw.getPreviewer()
  const previewCurElement = previewer.getCurElement()
  if (previewCurElement && previewer.getIsResizerVisible()) {
    console.log('%c[Backspace] Branch 2: Previewer Resizer Image Delete', 'color: #009688; font-weight: bold')
    previewer.clearResizer()
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
  } else if (previewCurElement) {
    previewer.clearResizer()
  }

  // 3. 表格跨行列删除
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

  // 4. 隐藏元素删除 / 跳过留痕删除元素
  backspaceHideElement(host)

  // 5. 控件内部事件捕获
  if (!control.getActiveControl()) {
    control.initControl()
  }
  if (control.getActiveControl() && control.getIsRangeCanCaptureEvent()) {
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

  // 6. 普通闭合光标元素删除
  const cursorPosition = draw.getPosition().getCursorPosition()
  if (!cursorPosition) return
  const { index } = cursorPosition

  // 首字符列表处理
  if (index === 0) {
    const firstElement = elementList[index]
    if (firstElement?.value === ZERO) {
      if (firstElement.listId) {
        if (firstElement.listLevel) {
          draw.getListParticle().decreaseListLevel()
        } else {
          draw.getListParticle().unsetList()
        }
      }
      evt.preventDefault()
      return
    }
  }

  const startElement = elementList[startIndex]
  if (startElement?.rowFlex && startElement?.value === ZERO) {
    const rowFlexElementList = rangeManager.getRangeRowElementList()
    if (rowFlexElementList) {
      const preElement = elementList[startIndex - 1]
      rowFlexElementList.forEach(element => {
        element.rowFlex = preElement?.rowFlex
      })
    }
  }

  const preElement =
    startElement?.value === ZERO ? elementList[startIndex - 1] : startElement
  const nextElement = elementList[endIndex + 1]
  if (
    preElement?.titleId &&
    nextElement?.titleId &&
    preElement.level === nextElement.level &&
    preElement.titleId !== nextElement.titleId
  ) {
    const preTitleId = preElement.titleId
    const nextTitleId = nextElement.titleId
    let nextIndex = endIndex + 1
    while (
      nextIndex < elementList.length &&
      elementList[nextIndex]?.titleId === nextTitleId
    ) {
      elementList[nextIndex].titleId = preTitleId
      nextIndex++
    }
  }

  let curIndex: number | null = null
  const curTargetElement = elementList[index]
  const cId = curTargetElement?.controlId
  const isPreviewEdit = draw.getMode() === EditorMode.PREVIEW_EDIT

  // 优先拦截并删除换行符与空行节点：严格只删除这一行空白，绝不波及上方图片或控件
  if (curTargetElement?.value === '\n' || curTargetElement?.value === ZERO) {
    draw.deleteElementList(elementList, index, 1)
    const newIdx = Math.max(0, index - 1)
    draw.getGlobalEvent().setCanvasEventAbility()
    rangeManager.setRange(newIdx, newIdx)
    draw.render({ curIndex: newIdx })
    return
  }

  if (curTargetElement?.type === ElementType.IMAGE) {
    if ((curTargetElement as any)._isImageDeleting) {
      delete (curTargetElement as any)._isImageDeleting
      const isList =
        curTargetElement?.control?.listType === 'image' ||
        Boolean(curTargetElement?.control?.listType) ||
        (curTargetElement?.control?.type as any) === 'list'
      if (curTargetElement?.controlId && isList) {
        // 多图列表控件：退格仅删除当前选中的这一张图片
        draw.deleteElementList(elementList, index, 1)
        const newIdx = Math.max(0, index - 1)
        const remainImages = elementList.filter(
          el => el.controlId === cId && el.type === ElementType.IMAGE
        )
        const cleanImages = remainImages.map(img => {
          const copy = { ...img }
          delete copy.control
          delete copy.controlComponent
          delete copy.controlId
          return copy
        })
        for (let i = 0; i < elementList.length; i++) {
          if (elementList[i]?.controlId === cId && elementList[i].control) {
            elementList[i].control!.value = cleanImages
          }
        }
        if (remainImages.length === 0) {
          if (isPreviewEdit) {
            curIndex = control.removeControl(newIdx)
          } else {
            control.addPlaceholder(newIdx)
            curIndex = newIdx
          }
        } else {
          curIndex = newIdx
        }
      } else if (curTargetElement?.controlId) {
        curIndex = control.removeControl(index)
      } else {
        draw.deleteElementList(elementList, index, 1)
        curIndex = index - 1
      }
    } else {
      // 首次退格到达真正的图片本体时，不立即删除图片，光标停留在图片后方并保持正常闪烁
      ;(curTargetElement as any)._isImageDeleting = true
      curIndex = index
    }
  } else if (
    (curTargetElement?.controlComponent === ControlComponent.PREFIX ||
      curTargetElement?.controlComponent === ControlComponent.PRE_TEXT ||
      curTargetElement?.controlComponent === ControlComponent.PLACEHOLDER) &&
    curTargetElement?.control?.type !== ControlType.IMAGE
  ) {
    curIndex = control.removeControl(index)
  } else if (curTargetElement?.controlComponent === ControlComponent.POSTFIX) {
    const isListControl = Boolean(
      curTargetElement?.control?.listType ||
        (curTargetElement?.control?.type as any) === 'list' ||
        curTargetElement?.control?.type === ControlType.CHECKBOX ||
        curTargetElement?.control?.type === ControlType.RADIO
    )
    if (isListControl) {
      if (isPreviewEdit) {
        // 无痕模式下花括号不可见，末尾退格不应整块销毁控件，而是安全将光标落入末尾内容项逐步删除
        curIndex = Math.max(0, index - 1)
      } else {
        curIndex = control.removeControl(index)
      }
    } else {
      // 检查普通控件内是否含有实际 VALUE 内容
      const targetCId = curTargetElement.controlId
      let hasValue = false
      if (targetCId) {
        for (let i = 0; i < elementList.length; i++) {
          if (
            elementList[i]?.controlId === targetCId &&
            elementList[i]?.controlComponent === ControlComponent.VALUE
          ) {
            hasValue = true
            break
          }
        }
      }
      if (!hasValue) {
        // 未填写的空占位符控件：在花括号后退格直接整体删除
        curIndex = control.removeControl(index)
      } else {
        // 已有内容的文本控件：将光标安全移入控件末尾，供用户逐字编辑，绝不误删整段文字
        curIndex = Math.max(0, index - 1)
      }
    }
  } else if (cId && curTargetElement?.controlComponent === ControlComponent.VALUE) {
    // 控件内单字删除：仅删除当前选中的这 1 个字符
    draw.deleteElementList(elementList, index, 1)
    const newIdx = Math.max(0, index - 1)

    // 检查该控件是否还有剩余的 VALUE 文本字符
    let hasRemainValue = false
    for (let i = 0; i < elementList.length; i++) {
      if (
        elementList[i]?.controlId === cId &&
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
        curIndex = control.removeControl(newIdx)
      } else {
        control.addPlaceholder(newIdx)
        curIndex = newIdx
      }
    } else {
      curIndex = newIdx
    }
  } else {
    if (index >= 0 && index < elementList.length) {
      draw.deleteElementList(elementList, index, 1)
      curIndex = index - 1
    } else {
      curIndex = Math.max(0, index - 1)
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
