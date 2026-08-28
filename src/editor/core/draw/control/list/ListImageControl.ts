import { ZERO } from '../../../../dataset/constant/Common'
import { CONTROL_STYLE_ATTR } from '../../../../dataset/constant/Element'
import { ControlComponent } from '../../../../dataset/enum/Control'
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
      const imgWidth = control?.width || 80
      const imgHeight = control?.height || 80
      data.forEach((img: any, idx: number) => {
        const url = typeof img === 'string' ? img : img?.url || img?.src || ''
        if (url) {
          newNodes.push({
            ...anchorElement,
            type: ElementType.IMAGE,
            value: url,
            width: imgWidth,
            height: imgHeight,
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
      const placeholderStrList = splitText(`@${control.placeholder}`)
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

    const insertAt = prefixIndex !== -1 ? prefixIndex + 1 : firstIndex !== -1 ? firstIndex : 0
    const deleteCount =
      postfixIndex !== -1 ? postfixIndex - insertAt : lastIndex !== -1 ? lastIndex - insertAt + 1 : 0

    if (deleteCount > 0) {
      draw.deleteElementList(elementList, insertAt, deleteCount, {
        isIgnoreDeletedRule: options.isIgnoreDeletedRule
      })
    }

    if (newNodes.length) {
      formatElementList(newNodes, {
        isHandleFirstElement: false,
        editorOptions: draw.getOptions()
      })
      draw.spliceElementList(elementList, insertAt, 0, newNodes)
    }

    this.control.emitControlContentChange({
      context
    })
    return insertAt + newNodes.length
  }
}
