import { ZERO } from '../../../../dataset/constant/Common'
import { CONTROL_STYLE_ATTR } from '../../../../dataset/constant/Element'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { ElementType } from '../../../../dataset/enum/Element'
import { KeyMap } from '../../../../dataset/enum/KeyMap'
import {
  IControlContext,
  IControlInstance,
  IControlRuleOption
} from '../../../../interface/Control'
import { IElement } from '../../../../interface/Element'
import { pickObject, splitText } from '../../../../utils'
import { formatElementList } from '../../../../utils/element'
import { Control } from '../Control'

export class ImageControl implements IControlInstance {
  protected element: IElement
  protected control: Control

  constructor(element: IElement, control: Control) {
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
    if (!startElement || !startElement.controlId) return data

    for (let i = 0; i < elementList.length; i++) {
      const el = elementList[i]
      if (
        el.controlId === startElement.controlId &&
        el.controlComponent === ControlComponent.VALUE &&
        el.type === ElementType.IMAGE
      ) {
        data.push(el)
      }
    }
    return data
  }

  public setValue(
    data: IElement[] | string | any,
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

    let formatValue: IElement[] = []
    const firstItem = Array.isArray(data) ? data[0] : data
    if (
      Array.isArray(data) &&
      data.length > 0 &&
      data[0]?.type === ElementType.IMAGE
    ) {
      formatValue = data
    } else if (typeof data === 'string' && data) {
      const isImgUrl =
        data.startsWith('http') ||
        data.startsWith('data:image') ||
        data.startsWith('/') ||
        data.startsWith('./') ||
        data.startsWith('blob:')
      if (isImgUrl) {
        formatValue = [
          {
            type: ElementType.IMAGE,
            value: data,
            width: control?.width || 120,
            height: control?.height || 120
          }
        ]
      }
    } else if (firstItem && typeof firstItem === 'object') {
      const url =
        firstItem.url ||
        firstItem.src ||
        (firstItem.type === ElementType.IMAGE ? firstItem.value : '')
      if (url) {
        const itemWidth =
          Number(firstItem.width) || control?.width || 120
        const itemHeight =
          Number(firstItem.height) || control?.height || 120
        formatValue = [
          {
            type: ElementType.IMAGE,
            value: url,
            width: itemWidth,
            height: itemHeight
          }
        ]
      }
    }

    if (formatValue.length) {
      formatElementList(formatValue, {
        isHandleFirstElement: false,
        editorOptions: draw.getOptions()
      })
    } else if (control?.placeholder) {
      const placeholderStrList = splitText(control.placeholder)
      const placeholderArgs: Omit<IElement, 'value'> = {
        color: draw.getOptions().control.placeholderColor
      }
      formatValue = placeholderStrList.map(v => ({
        ...placeholderArgs,
        value: v === '\n' ? ZERO : v,
        controlComponent: ControlComponent.PLACEHOLDER
      }))
    }

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

    const isPlaceholderState = !formatValue.some(
      v => v.controlComponent !== ControlComponent.PLACEHOLDER
    )
    const anchorElement = pickObject(
      elementList[prefixIndex !== -1 ? prefixIndex : firstIndex !== -1 ? firstIndex : 0] ||
        this.element,
      ['control', 'controlId', ...CONTROL_STYLE_ATTR]
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

    const newNodes: IElement[] = []
    if (prefixIndex === -1) {
      newNodes.push({
        ...anchorElement,
        type: ElementType.CONTROL,
        value: control?.prefix || '{',
        controlComponent: ControlComponent.PREFIX,
        isPlaceholder: isPlaceholderState
      })
    } else if (elementList[prefixIndex]) {
      elementList[prefixIndex].isPlaceholder = isPlaceholderState
    }

    formatValue.forEach(item => {
      newNodes.push({
        ...anchorElement,
        ...item,
        controlComponent: item.controlComponent || ControlComponent.VALUE,
        isPlaceholder: isPlaceholderState
      })
    })

    if (postfixIndex === -1) {
      newNodes.push({
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

    if (newNodes.length) {
      draw.spliceElementList(elementList, insertAt, 0, newNodes)
    }

    this.control.emitControlContentChange({
      context
    })
    return insertAt + newNodes.length
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (this.control.getIsDisabledControl()) {
      return null
    }
    const elementList = this.control.getElementList()
    const { startIndex, endIndex } = this.control.getRange()
    const isCollapsed = startIndex === endIndex

    if (evt.key === KeyMap.Backspace || evt.key === KeyMap.Delete) {
      this.control.getDraw().getPreviewer().clearResizer()
      if (!isCollapsed) {
        return this.control.cleanSelectionDelete(elementList, startIndex, endIndex)
      }
      return null
    }
    return null
  }

  public cut(): number {
    if (this.control.getIsDisabledControl()) {
      return -1
    }
    const elementList = this.control.getElementList()
    const { startIndex, endIndex } = this.control.getRange()
    this.control.getDraw().getPreviewer().clearResizer()
    if (startIndex !== endIndex) {
      return this.control.cleanSelectionDelete(elementList, startIndex, endIndex)
    }
    const res = this.control.removeControl(startIndex)
    return res !== null ? res : -1
  }
}
