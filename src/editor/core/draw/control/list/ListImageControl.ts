import { ZERO } from '../../../../dataset/constant/Common'
import { CONTROL_STYLE_ATTR } from '../../../../dataset/constant/Element'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { EditorMode } from '../../../../dataset/enum/Editor'
import { ElementType } from '../../../../dataset/enum/Element'
import {
  IControlContext,
  IControlRuleOption
} from '../../../../interface/Control'
import { IElement } from '../../../../interface/Element'
import { pickObject, splitText } from '../../../../utils'
import { formatElementList } from '../../../../utils/element'
import { ImageControl } from '../image/ImageControl'

export class ListImageControl extends ImageControl {
  public setValue(
    data: IElement[] | string | any[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    if (
      !options.isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const draw = this.control.getDraw()
    const { control } = this.element
    const targetControlId = this.element.controlId
    const layout = control?.layout || 'grid'
    const gridCols = Math.max(1, Number(control?.gridCols) || 2)
    const isVertical = layout === 'vertical'
    const isGrid = layout === 'grid'

    // 定位 PREFIX / POSTFIX 边界
    let prefixIndex = -1
    let postfixIndex = -1
    let firstIndex = -1
    let lastIndex = -1
    for (let i = 0; i < elementList.length; i++) {
      const el = elementList[i]
      if (el.controlId === targetControlId) {
        if (firstIndex === -1) firstIndex = i
        lastIndex = i
        if (el.controlComponent === ControlComponent.PREFIX) {
          prefixIndex = i
        }
        if (el.controlComponent === ControlComponent.POSTFIX) {
          postfixIndex = i
        }
      }
    }

    const anchorElement = pickObject(
      elementList[prefixIndex !== -1 ? prefixIndex : firstIndex !== -1 ? firstIndex : 0] || this.element,
      ['control', 'controlId', ...CONTROL_STYLE_ATTR]
    )

    let newNodes: IElement[] = []
    if (Array.isArray(data) && data.length > 0) {
      data.forEach((img: any, idx: number) => {
        const url = typeof img === 'string' ? img : img?.url || img?.src || ''
        if (url) {
          const itemWidth = Number(img?.width) || control?.width || 80
          const itemHeight = Number(img?.height) || control?.height || 80
          newNodes.push({
            ...anchorElement,
            type: ElementType.IMAGE,
            value: url,
            width: itemWidth,
            height: itemHeight,
            controlComponent: ControlComponent.VALUE
          })
          const shouldWrap =
            (isVertical && idx < data.length - 1) ||
            (isGrid && (idx + 1) % gridCols === 0 && idx < data.length - 1)
          if (shouldWrap) {
            newNodes.push({
              ...anchorElement,
              value: ZERO,
              controlComponent: ControlComponent.VALUE
            })
          } else if (idx < data.length - 1) {
            newNodes.push({
              ...anchorElement,
              value: '  ',
              controlComponent: ControlComponent.VALUE
            })
          }
        }
      })
    } else if (typeof data === 'string' && data) {
      newNodes.push({
        ...anchorElement,
        type: ElementType.IMAGE,
        value: data,
        width: control?.width || 80,
        height: control?.height || 80,
        controlComponent: ControlComponent.VALUE
      })
    } else if (control?.placeholder) {
      const placeholderStrList = splitText(control.placeholder)
      const placeholderArgs: Omit<IElement, 'value'> = {
        color: draw.getOptions().control.placeholderColor
      }
      newNodes = placeholderStrList.map(v => ({
        ...anchorElement,
        ...placeholderArgs,
        value: v === '\n' ? ZERO : v,
        controlComponent: ControlComponent.PLACEHOLDER
      }))
    }

    const isPlaceholderState = !newNodes.some(
      v => v.controlComponent !== ControlComponent.PLACEHOLDER
    )

    const insertAt = prefixIndex !== -1 ? prefixIndex + 1 : firstIndex !== -1 ? firstIndex : 0
    const deleteCount =
      postfixIndex !== -1
        ? postfixIndex - insertAt
        : lastIndex !== -1
        ? lastIndex - insertAt + 1
        : 0

    if (deleteCount > 0) {
      draw.deleteElementList(elementList, insertAt, deleteCount, {
        isIgnoreDeletedRule: options.isIgnoreDeletedRule
      })
    }

    const fullNodes: IElement[] = []
    if (prefixIndex === -1) {
      fullNodes.push({
        ...anchorElement,
        type: ElementType.CONTROL,
        value: control?.prefix || '{',
        controlComponent: ControlComponent.PREFIX,
        isPlaceholder: isPlaceholderState
      })
    } else if (elementList[prefixIndex]) {
      elementList[prefixIndex].isPlaceholder = isPlaceholderState
    }

    newNodes.forEach(item => {
      fullNodes.push({
        ...anchorElement,
        ...item,
        isPlaceholder: isPlaceholderState
      })
    })

    if (postfixIndex === -1) {
      fullNodes.push({
        ...anchorElement,
        type: ElementType.CONTROL,
        value: control?.postfix || '}',
        controlComponent: ControlComponent.POSTFIX,
        isPlaceholder: isPlaceholderState
      })
    } else {
      for (let k = 0; k < elementList.length; k++) {
        if (
          elementList[k]?.controlId === targetControlId &&
          elementList[k]?.controlComponent === ControlComponent.POSTFIX
        ) {
          elementList[k].isPlaceholder = isPlaceholderState
        }
      }
    }

    if (fullNodes.length) {
      formatElementList(fullNodes, {
        isHandleFirstElement: false,
        editorOptions: draw.getOptions()
      })
      draw.spliceElementList(elementList, insertAt, 0, fullNodes)
    }

    this.control.emitControlContentChange({
      context
    })
    return insertAt + fullNodes.length
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (this.control.getIsDisabledControl()) {
      return null
    }
    const elementList = this.control.getElementList()
    const { startIndex, endIndex } = this.control.getRange()
    const isCollapsed = startIndex === endIndex
    const startElement = elementList[startIndex]
    const cId = startElement?.controlId || elementList[endIndex]?.controlId
    const isPreviewEdit = this.control.getDraw().getMode() === EditorMode.PREVIEW_EDIT

    if (evt.key === 'Backspace') {
      if (!isCollapsed) {
        return this.control.cleanSelectionDelete(elementList, startIndex, endIndex)
      }

      // 1. 如果光标在两张图片之间的空格处：只删除空格，绝对不删除图片！
      if (
        startElement?.controlId === cId &&
        startElement?.controlComponent === ControlComponent.VALUE &&
        (startElement?.value === ' ' || startElement?.value === '  ')
      ) {
        this.control.getDraw().deleteElementList(elementList, startIndex, 1)
        return Math.max(0, startIndex - 1)
      }

      // 2. 如果光标位于单张图片处：仅删除当前这张图片
      if (
        startElement?.controlId === cId &&
        startElement?.type === ElementType.IMAGE
      ) {
        this.control.getDraw().deleteElementList(elementList, startIndex, 1)
        const newIdx = Math.max(0, startIndex - 1)
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
            return this.control.removeControl(newIdx)
          } else {
            this.control.addPlaceholder(newIdx)
            return newIdx
          }
        }
        return newIdx
      }

      // 3. 如果光标在占位符或前缀处
      if (
        startElement?.controlComponent === ControlComponent.PREFIX ||
        startElement?.controlComponent === ControlComponent.PLACEHOLDER
      ) {
        return this.control.removeControl(startIndex)
      }

      // 4. 如果光标在后缀 POSTFIX 处
      if (startElement?.controlComponent === ControlComponent.POSTFIX) {
        if (isPreviewEdit) {
          // 无痕模式下花括号不可见，末尾退格等同于删除最后一张图片
          let lastImgIdx = -1
          for (let i = startIndex - 1; i >= 0; i--) {
            if (elementList[i]?.controlId === cId) {
              if (elementList[i].type === ElementType.IMAGE) {
                lastImgIdx = i
                break
              }
            } else {
              break
            }
          }
          if (lastImgIdx !== -1) {
            this.control.getDraw().deleteElementList(elementList, lastImgIdx, 1)
            if (
              elementList[lastImgIdx]?.value === ' ' ||
              elementList[lastImgIdx]?.value === '  ' ||
              elementList[lastImgIdx]?.value === ZERO
            ) {
              this.control.getDraw().deleteElementList(elementList, lastImgIdx, 1)
            }
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
              return this.control.removeControl(Math.max(0, lastImgIdx - 1))
            }
            return Math.max(0, lastImgIdx - 1)
          }
          return Math.max(0, startIndex - 1)
        } else {
          return this.control.removeControl(startIndex)
        }
      }
    } else if (evt.key === 'Delete') {
      if (!isCollapsed) {
        return this.control.cleanSelectionDelete(elementList, startIndex, endIndex)
      }
      const nextIdx = endIndex + 1
      const nextElement = elementList[nextIdx]

      // 1. 如果下一个元素是两张图片之间的空格：只删除空格
      if (
        nextElement?.controlId === cId &&
        nextElement?.controlComponent === ControlComponent.VALUE &&
        (nextElement?.value === ' ' || nextElement?.value === '  ')
      ) {
        this.control.getDraw().deleteElementList(elementList, nextIdx, 1)
        return endIndex
      }

      // 2. 如果下一个元素是图片：仅删除该图片
      if (
        nextElement?.controlId === cId &&
        nextElement?.type === ElementType.IMAGE
      ) {
        this.control.getDraw().deleteElementList(elementList, nextIdx, 1)
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
            return this.control.removeControl(endIndex)
          } else {
            this.control.addPlaceholder(endIndex)
            return endIndex
          }
        }
        return endIndex
      }
    }
    return null
  }
}
