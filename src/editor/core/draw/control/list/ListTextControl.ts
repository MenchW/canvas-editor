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

    // 判断是否为外部下发的多项分段业务列表数据
    // 典型特征：数组元素为字符串，或者包含 label/name/text，或者单个元素为长度大于1的长字符串
    const isMultiItemBusinessList =
      Array.isArray(data) &&
      data.length > 1 &&
      data.some(
        item =>
          typeof item === 'string' ||
          (typeof item === 'object' &&
            item !== null &&
            (item.label !== undefined ||
              item.name !== undefined ||
              item.text !== undefined ||
              (typeof item.value === 'string' && item.value.length > 1)))
      )

    let formatValue: IElement[] = []
    if (isMultiItemBusinessList) {
      // 外部多项分段列表数据回显：根据控件 layout (水平空格并排/垂直换行/网格换行) 格式化
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
    } else if (Array.isArray(data)) {
      // 键盘输入字符流或单一项文本元素：直接作为连续文本插入，绝不随意拆分换行
      return super.setValue(data, context, options)
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
