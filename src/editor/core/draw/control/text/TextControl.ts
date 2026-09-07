import { ZERO } from '../../../../dataset/constant/Common'
import {
  CONTROL_STYLE_ATTR,
  TABLE_CONTEXT_ATTR
} from '../../../../dataset/constant/Element'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { EditorMode } from '../../../../dataset/enum/Editor'
import { KeyMap } from '../../../../dataset/enum/KeyMap'
import { DeepRequired } from '../../../../interface/Common'
import {
  IControlContext,
  IControlInstance,
  IControlRuleOption
} from '../../../../interface/Control'
import { IEditorOption } from '../../../../interface/Editor'
import { IElement } from '../../../../interface/Element'
import { pickObject, splitText } from '../../../../utils'
import {
  formatElementContext,
  isElementTraceDeleted,
  scanToOwner
} from '../../../../utils/element'
import { Control } from '../Control'

export class TextControl implements IControlInstance {
  protected element: IElement
  protected control: Control
  protected options: DeepRequired<IEditorOption>

  constructor(element: IElement, control: Control) {
    const draw = control.getDraw()
    this.options = draw.getOptions()
    this.element = element
    this.control = control
  }

  public setElement(element: IElement) {
    this.element = element
  }

  public getElement(): IElement {
    return this.element
  }

  public getValue(context: IControlContext = {}): IElement[] {
    const elementList = context.elementList || this.control.getElementList()
    const { startIndex } = context.range || this.control.getRange()
    const startElement = elementList[startIndex]
    const data: IElement[] = []
    if (!startElement?.controlId) return data
    if (
      startElement.controlComponent === ControlComponent.VALUE &&
      !isElementTraceDeleted(startElement)
    ) {
      data.push(startElement)
    }
    // 向左查找
    let preIndex = startIndex
    while (preIndex > 0) {
      const next = scanToOwner(
        elementList,
        preIndex,
        -1,
        startElement.controlId!
      )
      if (next < 0) break
      const preElement = elementList[next]
      if (
        preElement.controlId !== startElement.controlId ||
        preElement.controlComponent === ControlComponent.PREFIX ||
        preElement.controlComponent === ControlComponent.PRE_TEXT
      ) {
        break
      }
      if (
        preElement.controlComponent === ControlComponent.VALUE &&
        !isElementTraceDeleted(preElement)
      ) {
        data.unshift(preElement)
      }
      preIndex = next
    }
    // 向右查找
    let nextIndex = startIndex + 1
    while (nextIndex < elementList.length) {
      const next = scanToOwner(
        elementList,
        nextIndex,
        1,
        startElement.controlId!
      )
      if (next < 0 || next >= elementList.length) break
      const nextElement = elementList[next]
      if (
        nextElement.controlId !== startElement.controlId ||
        nextElement.controlComponent === ControlComponent.POSTFIX ||
        nextElement.controlComponent === ControlComponent.POST_TEXT
      ) {
        break
      }
      if (
        nextElement.controlComponent === ControlComponent.VALUE &&
        !isElementTraceDeleted(nextElement)
      ) {
        data.push(nextElement)
      }
      nextIndex = next
    }
    return data
  }

  public setValue(
    data: IElement[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    // 校验是否可以设置
    if (
      !options.isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const range = context.range || this.control.getRange()
    // 收缩边界到Value内
    this.control.shrinkBoundary(context)
    const { startIndex, endIndex } = range
    const draw = this.control.getDraw()
    const startElement = elementList[startIndex]
    // 选区跨内层段时，连同内层一起替换。若内层处于 active 先销毁
    const activeControl = this.control.getActiveControl()
    const activeElement = activeControl?.getElement()
    if (
      activeElement &&
      activeElement.controlId &&
      activeElement.controlId !== startElement.controlId
    ) {
      let inRange = false
      for (let i = startIndex; i <= endIndex; i++) {
        if (elementList[i]?.controlId === activeElement.controlId) {
          inRange = true
          break
        }
      }
      if (inRange) {
        this.control.destroyControl({ isEmitEvent: true })
      }
    }
    // 移除选区元素（严格只移除 PREFIX 与 POSTFIX 之间的旧值或占位符，绝不删除 POSTFIX）
    const deleteStartIndex = startIndex + 1
    let deleteCount = endIndex - startIndex
    const endElement = elementList[endIndex]
    if (
      startElement?.controlId &&
      endElement?.controlId === startElement.controlId &&
      startElement.controlComponent === ControlComponent.PREFIX &&
      endElement.controlComponent === ControlComponent.POSTFIX
    ) {
      deleteCount = Math.max(0, endIndex - startIndex - 1)
    }

    if (deleteCount > 0) {
      const remainingCount = this.control.removePlaceholderInRange(
        elementList,
        deleteStartIndex,
        deleteCount
      )
      if (remainingCount > 0) {
        draw.deleteElementList(
          elementList,
          deleteStartIndex,
          remainingCount,
          {
            isIgnoreDeletedRule: options.isIgnoreDeletedRule
          }
        )
      }
    } else {
      // 移除空白占位符
      this.control.removePlaceholder(startIndex, context)
    }
    // 聚合当前控件范围内配置的用户自定义样式 (字号、颜色、粗体、下划线等)
    const controlStyle: Partial<IElement> = {}
    CONTROL_STYLE_ATTR.forEach(attr => {
      const isBracketEl =
        startElement.controlComponent === ControlComponent.PREFIX ||
        startElement.controlComponent === ControlComponent.POSTFIX
      if (attr === 'color' && isBracketEl) {
        if (startElement.control?.color !== undefined) {
          controlStyle.color = startElement.control.color
        } else if (this.element.control?.color !== undefined) {
          controlStyle.color = this.element.control.color
        } else if (this.element.color !== undefined) {
          controlStyle.color = this.element.color
        }
      } else {
        if (startElement[attr] !== undefined) {
          controlStyle[attr] = startElement[attr] as any
        } else if (startElement.control && (startElement.control as any)[attr] !== undefined) {
          controlStyle[attr] = (startElement.control as any)[attr]
        } else if (this.element.control && (this.element.control as any)[attr] !== undefined) {
          controlStyle[attr] = (this.element.control as any)[attr]
        } else if (this.element[attr] !== undefined) {
          controlStyle[attr] = this.element[attr] as any
        }
      }
    })

    const anchorElement: IElement = {
      ...pickObject(startElement, [
        'control',
        'controlId',
        'rowMargin',
        'rowFlex',
        ...TABLE_CONTEXT_ATTR
      ]),
      ...controlStyle
    }

    let formatData: IElement[] = []
    if (typeof data === 'string') {
      formatData = splitText(data).map(ch => ({
        value: ch === '\n' ? ZERO : ch
      }))
    } else if (Array.isArray(data)) {
      formatData = data.flatMap(item => {
        if (typeof item === 'string') {
          return splitText(item).map(ch => ({
            value: ch === '\n' ? ZERO : ch
          }))
        }
        if (
          item &&
          typeof item === 'object' &&
          'value' in item &&
          typeof item.value === 'string' &&
          item.value.length > 1
        ) {
          return splitText(item.value).map(ch => ({
            ...item,
            value: ch === '\n' ? ZERO : ch
          }))
        }
        return [
          item && typeof item === 'object' && 'value' in item
            ? item
            : { value: String(item ?? '') }
        ]
      })
    }
    // 插入起始位置
    const start = range.startIndex + 1
    for (let i = 0; i < formatData.length; i++) {
      const itemData = formatData[i]
      const newElement: IElement = {
        ...anchorElement,
        ...itemData,
        color: itemData.color || anchorElement.color,
        size: itemData.size || anchorElement.size,
        bold: itemData.bold !== undefined ? itemData.bold : anchorElement.bold,
        italic: itemData.italic !== undefined ? itemData.italic : anchorElement.italic,
        underline: itemData.underline !== undefined ? itemData.underline : anchorElement.underline,
        controlComponent: ControlComponent.VALUE
      }
      formatElementContext(elementList, [newElement], start + i, {
        editorOptions: this.options
      })
      draw.getTraceParticle().markElementListInserted([newElement])
      draw.spliceElementList(elementList, start + i, 0, [newElement])
    }

    // 插入真实值后：将该控件所属的所有元素（含前后缀）标记为已非占位符 (isPlaceholder = false)
    const targetControlId = startElement?.controlId
    if (targetControlId) {
      for (let i = 0; i < elementList.length; i++) {
        const el = elementList[i]
        if (el?.controlId === targetControlId) {
          el.isPlaceholder = false
          if (el.control) {
            delete (el.control as any).isPlaceholder
          }
        }
      }
    }

    return start + formatData.length - 1
  }

  public clearValue(
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    const { isIgnoreDisabledRule = false, isAddPlaceholder = true } = options
    // 校验是否可以设置
    if (
      !isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const range =
      context.range || this.control.getValueRange(context) || this.control.getRange()
    let { startIndex, endIndex } = range
    if (!~startIndex || !~endIndex) return -1

    // 确保 startIndex 精准定位到 PREFIX
    const startElement = elementList[startIndex]
    if (startElement?.controlId && startElement.controlComponent !== ControlComponent.PREFIX) {
      let pre = startIndex
      while (pre >= 0 && elementList[pre]?.controlId === startElement.controlId) {
        if (elementList[pre].controlComponent === ControlComponent.PREFIX) {
          startIndex = pre
          break
        }
        pre--
      }
    }

    // 确保 endIndex 精准定位到 POSTFIX
    const currentControlId = elementList[startIndex]?.controlId
    if (currentControlId) {
      let next = startIndex + 1
      while (next < elementList.length) {
        if (
          elementList[next]?.controlId === currentControlId &&
          elementList[next]?.controlComponent === ControlComponent.POSTFIX
        ) {
          endIndex = next
          break
        }
        if (elementList[next]?.controlId !== currentControlId) {
          endIndex = next - 1
          break
        }
        next++
      }
    }

    // 删除区间严格位于 PREFIX 与 POSTFIX 之间
    const deleteStartIndex = startIndex + 1
    const rawDeleteCount = Math.max(0, endIndex - startIndex - 1)

    const deleteCount = this.control.removePlaceholderInRange(
      elementList,
      deleteStartIndex,
      rawDeleteCount
    )
    if (deleteCount > 0) {
      this.control
        .getDraw()
        .deleteElementList(elementList, deleteStartIndex, deleteCount, {
          isIgnoreDeletedRule: options.isIgnoreDeletedRule
        })
    }

    // 增加占位符
    if (isAddPlaceholder) {
      this.control.addPlaceholder(startIndex, context)
    }

    this.control.setControlProperties(
      {
        value: null
      },
      {
        elementList,
        range: { startIndex, endIndex: startIndex }
      }
    )

    return startIndex
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (this.control.getIsDisabledControl()) {
      return null
    }
    const draw = this.control.getDraw()
    const isPreviewEdit = draw.getMode() === EditorMode.PREVIEW_EDIT
    const elementList = this.control.getElementList()
    const range = this.control.getRange()
    // 收缩边界到Value内
    this.control.shrinkBoundary()
    const { startIndex, endIndex } = range
    const startElement = elementList[startIndex]
    const endElement = elementList[endIndex]

    // backspace
    if (evt.key === KeyMap.Backspace) {
      // 移除选区元素
      if (startIndex !== endIndex) {
        draw.deleteElementList(
          elementList,
          startIndex + 1,
          endIndex - startIndex
        )
        const value = this.getValue()
        if (!value.length) {
          if (isPreviewEdit) {
            return this.control.removeControl(startIndex)
          } else {
            this.control.addPlaceholder(startIndex)
          }
        }
        return startIndex
      } else {
        if (
          startElement.controlComponent === ControlComponent.PREFIX ||
          startElement.controlComponent === ControlComponent.PRE_TEXT ||
          startElement.controlComponent === ControlComponent.PLACEHOLDER
        ) {
          // 前缀、占位符
          return this.control.removeControl(startIndex)
        } else if (
          endElement.controlComponent === ControlComponent.POSTFIX ||
          endElement.controlComponent === ControlComponent.POST_TEXT
        ) {
          // 后缀
          const isList = Boolean(
            startElement.control?.listType ||
              (startElement.control?.type as any) === 'list'
          )
          const targetCId = startElement.controlId
          const hasValue = elementList.some(
            el =>
              el.controlId === targetCId &&
              el.controlComponent === ControlComponent.VALUE
          )
          if (isList || !hasValue) {
            return this.control.removeControl(startIndex)
          }
          if (isPreviewEdit) {
            // 无痕模式下光标在后缀处按退格，逐字删除末位文本字符
            const leftValueIndex = startIndex - 1
            if (
              leftValueIndex >= 0 &&
              elementList[leftValueIndex]?.controlId === startElement.controlId &&
              elementList[leftValueIndex]?.controlComponent ===
                ControlComponent.VALUE
            ) {
              draw.deleteElementList(elementList, leftValueIndex, 1)
              const checkIndex = Math.max(0, leftValueIndex - 1)
              const curVal = this.getValue({
                range: { startIndex: checkIndex, endIndex: checkIndex },
                elementList
              })
              if (!curVal.length) {
                return this.control.removeControl(leftValueIndex - 1)
              }
              return leftValueIndex - 1
            }
          }
          // 普通已有内容的文本控件：光标安全移入控件内部末尾，供用户逐字退格编辑，绝不误删整段文字
          return Math.max(0, startIndex - 1)
        } else {
          // 文本
          draw.deleteElementList(elementList, startIndex, 1)
          const checkIndex = Math.max(0, startIndex - 1)
          const value = this.getValue({
            range: { startIndex: checkIndex, endIndex: checkIndex },
            elementList
          })
          if (!value.length) {
            if (isPreviewEdit) {
              return this.control.removeControl(startIndex - 1)
            } else {
              this.control.addPlaceholder(startIndex - 1)
            }
          }
          return startIndex - 1
        }
      }
    } else if (evt.key === KeyMap.Delete) {
      // 移除选区元素
      if (startIndex !== endIndex) {
        draw.deleteElementList(
          elementList,
          startIndex + 1,
          endIndex - startIndex
        )
        const value = this.getValue()
        if (!value.length) {
          if (isPreviewEdit) {
            return this.control.removeControl(startIndex)
          } else {
            this.control.addPlaceholder(startIndex)
          }
        }
        return startIndex
      } else {
        const endNextElement = elementList[endIndex + 1]
        if (
          ((startElement.controlComponent === ControlComponent.PREFIX ||
            startElement.controlComponent === ControlComponent.PRE_TEXT) &&
            endNextElement.controlComponent === ControlComponent.PLACEHOLDER) ||
          endNextElement.controlComponent === ControlComponent.POSTFIX ||
          endNextElement.controlComponent === ControlComponent.POST_TEXT ||
          startElement.controlComponent === ControlComponent.PLACEHOLDER
        ) {
          // 前缀、后缀、占位符
          return this.control.removeControl(startIndex)
        } else {
          // 文本
          draw.deleteElementList(elementList, startIndex + 1, 1)
          const value = this.getValue()
          if (!value.length) {
            if (isPreviewEdit) {
              return this.control.removeControl(startIndex)
            } else {
              this.control.addPlaceholder(startIndex)
            }
          }
          return startIndex
        }
      }
    }
    return endIndex
  }

  public cut(): number {
    if (this.control.getIsDisabledControl()) {
      return -1
    }
    this.control.shrinkBoundary()
    const { startIndex, endIndex } = this.control.getRange()
    if (startIndex === endIndex) {
      return startIndex
    }
    const draw = this.control.getDraw()
    const elementList = this.control.getElementList()
    draw.deleteElementList(elementList, startIndex + 1, endIndex - startIndex)
    const value = this.getValue()
    if (!value.length) {
      this.control.addPlaceholder(startIndex)
    }
    return startIndex
  }
}
