import { ZERO } from '../../../../dataset/constant/Common'
import { CONTROL_STYLE_ATTR } from '../../../../dataset/constant/Element'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { ElementType } from '../../../../dataset/enum/Element'
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
    if (Array.isArray(data) && data.length > 0 && data[0].type === ElementType.IMAGE) {
      formatValue = data
    } else if (typeof data === 'string' && data) {
      formatValue = [
        {
          type: ElementType.IMAGE,
          value: data,
          width: control?.width || 120,
          height: control?.height || 120
        }
      ]
    } else if (data && typeof data === 'object') {
      const url = data.url || data.src || data.value || ''
      if (url) {
        formatValue = [
          {
            type: ElementType.IMAGE,
            value: url,
            width: Number(data.width) || control?.width || 120,
            height: Number(data.height) || control?.height || 120
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
      const placeholderStrList = splitText(`@${control.placeholder}`)
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

    const insertAt = prefixIndex !== -1 ? prefixIndex + 1 : firstIndex
    const deleteCount =
      postfixIndex !== -1 ? postfixIndex - insertAt : lastIndex - firstIndex + 1

    if (deleteCount > 0) {
      draw.deleteElementList(elementList, insertAt, deleteCount, {
        isIgnoreDeletedRule: options.isIgnoreDeletedRule
      })
    }

    const anchorElement = pickObject(
      elementList[prefixIndex !== -1 ? prefixIndex : firstIndex] || this.element,
      ['control', 'controlId', ...CONTROL_STYLE_ATTR]
    )

    const newNodes: IElement[] = formatValue.map(item => ({
      ...anchorElement,
      ...item,
      controlComponent: item.controlComponent || ControlComponent.VALUE
    }))

    draw.spliceElementList(elementList, insertAt, 0, newNodes)

    this.control.emitControlContentChange({
      context
    })
    return insertAt + newNodes.length
  }

  public keydown(): number | null {
    if (this.control.getIsDisabledControl()) {
      return null
    }
    return null
  }

  public cut(): number {
    return -1
  }
}
