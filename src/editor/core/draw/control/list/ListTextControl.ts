import { ZERO } from '../../../../dataset/constant/Common'
import {
  IControlContext,
  IControlRuleOption
} from '../../../../interface/Control'
import { IElement } from '../../../../interface/Element'
import { splitText } from '../../../../utils'
import { formatElementList } from '../../../../utils/element'
import { TextControl } from '../text/TextControl'

export class ListTextControl extends TextControl {
  public setValue(
    data: IElement[] | string | any[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    const { control } = this.element
    const layout = control?.layout || 'vertical'
    const gridCols = Number(control?.gridCols) || 2
    const isVertical = layout === 'vertical'
    const isGrid = layout === 'grid'

    let formatValue: IElement[] = []
    if (Array.isArray(data)) {
      // 数组型数据：根据控件 layout (水平空格并排/垂直换行/网格换行) 格式化
      const textChars: IElement[] = []
      data.forEach((item: any, idx: number) => {
        let str = ''
        if (typeof item === 'object' && item !== null) {
          str = String(item.label ?? item.name ?? item.text ?? item.value ?? '')
        } else {
          str = String(item ?? '')
        }
        if (str) {
          splitText(str).forEach(ch => {
            textChars.push({ value: ch === '\n' ? ZERO : ch })
          })
          const shouldWrap =
            (isVertical && idx < data.length - 1) ||
            (isGrid && (idx + 1) % gridCols === 0 && idx < data.length - 1)
          if (shouldWrap) {
            textChars.push({ value: '\n' })
          } else if (idx < data.length - 1) {
            textChars.push({ value: '   ' })
          }
        }
      })
      formatValue = textChars
    } else if (typeof data === 'string' && data) {
      formatValue = [{ value: data }]
    }

    if (formatValue.length) {
      formatElementList(formatValue, {
        isHandleFirstElement: false,
        editorOptions: this.control.getDraw().getOptions()
      })
      return super.setValue(formatValue, context, options)
    } else {
      return this.clearValue(context, options)
    }
  }
}
