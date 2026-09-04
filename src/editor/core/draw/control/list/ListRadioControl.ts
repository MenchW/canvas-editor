import { ZERO } from '../../../../dataset/constant/Common'
import { CONTROL_STYLE_ATTR } from '../../../../dataset/constant/Element'
import { ControlComponent, ControlType } from '../../../../dataset/enum/Control'
import { ElementType } from '../../../../dataset/enum/Element'
import {
  IControlContext,
  IControlRuleOption
} from '../../../../interface/Control'
import { IElement } from '../../../../interface/Element'
import { pickObject, splitText } from '../../../../utils'
import { RadioControl } from '../radio/RadioControl'

export class ListRadioControl extends RadioControl {
  public setSelect(
    payload: string[] | any[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ) {
    if (
      !options.isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return
    }
    const { control } = this.element
    const draw = this.control.getDraw()
    const elementList = context.elementList || this.control.getElementList()
    const { startIndex } = context.range || this.control.getRange()
    const startElement = elementList[startIndex]
    const targetControlId = this.element.controlId || startElement?.controlId

    // 解析下发数据：支持选项数组 [{label, code, checked}]、codes 数组或标量值 ('1', '男' 等)
    let codes: string[] = []
    if (
      Array.isArray(payload) &&
      payload.length > 0 &&
      typeof payload[0] === 'object' &&
      payload[0] !== null
    ) {
      const valueSets: Array<{ value: string; code: string }> = []
      payload.forEach((item: any, idx: number) => {
        const label = String(
          item.label ?? item.text ?? item.name ?? item.value ?? `选项${idx + 1}`
        )
        const code = String(item.value ?? item.code ?? item.id ?? `${idx + 1}`)
        const checked = item.checked === true || item.selected === true
        valueSets.push({ value: label, code })
        if (checked) codes.push(code)
      })
      if (control) {
        control.valueSets = valueSets
      }
    } else if (Array.isArray(payload)) {
      codes = payload.map(String)
    } else if (payload !== null && payload !== undefined && payload !== '') {
      codes = [String(payload)]
    }

    let selectedCode =
      codes[0] || (control?.code ? String(control.code) : null)
    if (selectedCode && control?.valueSets) {
      const matchedByVal = control.valueSets.find(
        vs => vs.value === selectedCode || vs.code === selectedCode
      )
      if (matchedByVal) {
        selectedCode = matchedByVal.code
      }
    }

    // 检查是否存在 RADIO 选项元素，并定位 PREFIX / POSTFIX 边界
    let hasRadioEl = false
    let prefixIndex = -1
    let postfixIndex = -1
    let firstIndex = -1
    let lastIndex = -1
    if (targetControlId) {
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
          if (el.controlComponent === ControlComponent.RADIO && el.radio) {
            hasRadioEl = true
            el.radio.value = el.radio.code === selectedCode
          }
        }
      }
    }

    // 若已经处于展开状态，已原地更新勾选值，直接返回
    if (hasRadioEl) {
      if (control) {
        control.code = selectedCode
      }
      this.control.emitControlContentChange({
        context
      })
      return
    }

    // 若处于 PLACEHOLDER 占位符形态，根据 control.valueSets 与 layout 展开单选选项
    if (
      targetControlId &&
      Array.isArray(control?.valueSets) &&
      control.valueSets.length > 0
    ) {
      if (control) {
        control.type = ControlType.RADIO
        control.listType = 'radio'
        control.code = selectedCode
      }
      const anchorNode =
        elementList[prefixIndex !== -1 ? prefixIndex : firstIndex !== -1 ? firstIndex : startIndex] || this.element
      const anchorElement = pickObject(anchorNode, [
        'control',
        'controlId',
        ...CONTROL_STYLE_ATTR
      ])
      if (anchorElement.control) {
        anchorElement.control.type = ControlType.RADIO
        anchorElement.control.listType = 'radio'
        anchorElement.control.code = selectedCode
        anchorElement.control.valueSets = control?.valueSets
      }

      const newElements: IElement[] = []
      const valueSets = control!.valueSets
      const radioOption = draw.getOptions().radio
      const layout = control?.layout || 'horizontal'
      const isVertical = layout === 'vertical'
      const isGrid = layout === 'grid'
      const gridCols = Math.max(1, Number(control?.gridCols) || 2)

      for (let v = 0; v < valueSets.length; v++) {
        const valueSet = valueSets[v]
        newElements.push({
          ...anchorElement,
          value: '',
          type: ElementType.CONTROL,
          controlComponent: ControlComponent.RADIO,
          radio: {
            code: valueSet.code,
            value: valueSet.code === selectedCode
          }
        })
        const valueStrList = splitText(valueSet.value)
        for (let e = 0; e < valueStrList.length; e++) {
          const valChar = valueStrList[e]
          const isLastLetter = e === valueStrList.length - 1
          newElements.push({
            ...anchorElement,
            value: valChar === '\n' ? ZERO : valChar,
            letterSpacing: isLastLetter ? radioOption.gap : 0,
            controlComponent: ControlComponent.VALUE
          })
        }
        const shouldWrap =
          (isVertical && v < valueSets.length - 1) ||
          (isGrid && (v + 1) % gridCols === 0 && v < valueSets.length - 1)
        if (shouldWrap) {
          newElements.push({
            ...anchorElement,
            value: ZERO,
            controlComponent: ControlComponent.VALUE
          })
        } else if (v < valueSets.length - 1) {
          newElements.push({
            ...anchorElement,
            value: '  ',
            controlComponent: ControlComponent.VALUE
          })
        }
      }

      const insertAt = prefixIndex !== -1 ? prefixIndex + 1 : firstIndex !== -1 ? firstIndex : startIndex + 1
      const deleteCount =
        postfixIndex !== -1 ? postfixIndex - insertAt : lastIndex !== -1 ? lastIndex - insertAt + 1 : 0
      elementList.splice(insertAt, deleteCount, ...newElements)
    }

    if (control) {
      control.code = selectedCode
    }
    this.control.emitControlContentChange({
      context
    })
  }
}
