import { ZERO } from '../../../../dataset/constant/Common'
import { CONTROL_STYLE_ATTR } from '../../../../dataset/constant/Element'
import { ControlComponent, ControlType } from '../../../../dataset/enum/Control'
import { EditorMode } from '../../../../dataset/enum/Editor'
import { ElementType } from '../../../../dataset/enum/Element'
import { KeyMap } from '../../../../dataset/enum/KeyMap'
import {
  IControlContext,
  IControlInstance,
  IControlRuleOption
} from '../../../../interface/Control'
import { IElement } from '../../../../interface/Element'
import { pickObject, splitText } from '../../../../utils'
import { Control } from '../Control'

export class CheckboxControl implements IControlInstance {
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

  public getCode(): string | null {
    return this.element.control?.code || null
  }

  public getValue(): IElement[] {
    const elementList = this.control.getElementList()
    const { startIndex } = this.control.getRange()
    const startElement = elementList[startIndex]
    const data: IElement[] = []
    // 向左查找
    let preIndex = startIndex
    while (preIndex > 0) {
      const preElement = elementList[preIndex]
      if (
        preElement.controlId !== startElement.controlId ||
        preElement.controlComponent === ControlComponent.PREFIX ||
        preElement.controlComponent === ControlComponent.PRE_TEXT
      ) {
        break
      }
      if (preElement.controlComponent === ControlComponent.VALUE) {
        data.unshift(preElement)
      }
      preIndex--
    }
    // 向右查找
    let nextIndex = startIndex + 1
    while (nextIndex < elementList.length) {
      const nextElement = elementList[nextIndex]
      if (
        nextElement.controlId !== startElement.controlId ||
        nextElement.controlComponent === ControlComponent.POSTFIX ||
        nextElement.controlComponent === ControlComponent.POST_TEXT
      ) {
        break
      }
      if (nextElement.controlComponent === ControlComponent.VALUE) {
        data.push(nextElement)
      }
      nextIndex++
    }
    return data
  }

  public setValue(
    data: IElement[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    const draw = this.control.getDraw()
    const isPreviewEdit = draw.getMode() === EditorMode.PREVIEW_EDIT
    if (!isPreviewEdit) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const range = context.range || this.control.getRange()
    const { startIndex, endIndex } = range
    const startElement = elementList[startIndex]
    if (!startElement) return -1

    // 移除选区元素
    if (startIndex !== endIndex) {
      draw.deleteElementList(
        elementList,
        startIndex + 1,
        endIndex - startIndex,
        {
          isIgnoreDeletedRule: options.isIgnoreDeletedRule
        }
      )
    }

    const anchorElement = pickObject(startElement, [
      'control',
      'controlId',
      ...CONTROL_STYLE_ATTR
    ])

    // 插入新元素（例如换行符 ZERO 或编辑文本）
    const insertElements: IElement[] = data.map(item => ({
      ...anchorElement,
      ...item,
      controlComponent: ControlComponent.VALUE
    }))

    draw.spliceElementList(elementList, startIndex + 1, 0, insertElements)
    return startIndex + insertElements.length
  }

  public setSelect(
    payload: string[] | string | any[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ) {
    // 校验是否可以设置
    if (
      !options.isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return
    }
    const { control } = this.element
    const elementList = context.elementList || this.control.getElementList()
    const { startIndex } = context.range || this.control.getRange()
    const startElement = elementList[startIndex]
    const targetControlId = startElement?.controlId || this.element.controlId
    const draw = this.control.getDraw()

    // 解析下发数据：支持选项数组 [{label, code, checked}]、逗号分隔字符串或普通 codes 数组
    let codes: string[] = []
    if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'object' && payload[0] !== null) {
      const valueSets: Array<{ value: string; code: string }> = []
      payload.forEach((item: any, idx: number) => {
        const label = String(item.label ?? item.text ?? item.name ?? item.value ?? `条款${idx + 1}`)
        const code = String(item.value ?? item.code ?? item.id ?? `clause_${idx + 1}`)
        const checked = item.checked === true || item.selected === true
        valueSets.push({ value: label, code })
        if (checked) codes.push(code)
      })
      if (control) {
        control.valueSets = valueSets
      }
    } else if (Array.isArray(payload)) {
      codes = payload.map(String)
    } else if (typeof payload === 'string') {
      codes = payload ? payload.split(',') : []
    }

    if (control) {
      control.code = codes.length ? codes.join(',') : null
    }

    // 检查是否存在 CHECKBOX 选项元素，并定位 PREFIX / POSTFIX 边界
    let hasCheckboxEl = false
    let prefixIndex = -1
    let postfixIndex = -1
    if (targetControlId) {
      for (let i = 0; i < elementList.length; i++) {
        const el = elementList[i]
        if (el.controlId === targetControlId) {
          if (el.controlComponent === ControlComponent.PREFIX) {
            prefixIndex = i
          }
          if (el.controlComponent === ControlComponent.POSTFIX) {
            postfixIndex = i
          }
          if (el.controlComponent === ControlComponent.CHECKBOX) {
            hasCheckboxEl = true
            if (el.checkbox) {
              el.checkbox.value = codes.includes(el.checkbox.code!)
            }
          }
        }
      }
    }

    // 若处于 PLACEHOLDER 占位符形态，现在回显了数据，将占位符替换为展开的复选框选项列表
    if (
      !hasCheckboxEl &&
      targetControlId &&
      Array.isArray(control?.valueSets) &&
      control.valueSets.length > 0
    ) {
      if (control) {
        control.type = ControlType.CHECKBOX
        control.code = codes.length ? codes.join(',') : null
      }
      const anchorNode = elementList[prefixIndex !== -1 ? prefixIndex : startIndex] || this.element
      const anchorElement = pickObject(anchorNode, [
        'control',
        'controlId',
        ...CONTROL_STYLE_ATTR
      ])
      if (anchorElement.control) {
        anchorElement.control.type = ControlType.CHECKBOX
        anchorElement.control.code = codes.length ? codes.join(',') : null
        anchorElement.control.valueSets = control?.valueSets
      }

      const insertAt = prefixIndex !== -1 ? prefixIndex + 1 : startIndex + 1
      const deleteCount = postfixIndex !== -1 ? postfixIndex - insertAt : 0
      if (deleteCount > 0) {
        draw.deleteElementList(elementList, insertAt, deleteCount, {
          isIgnoreDeletedRule: options.isIgnoreDeletedRule
        })
      }
      const newElements: IElement[] = []
      const valueSets = control!.valueSets
      const checkboxOption = draw.getOptions().checkbox
      const layout = control?.layout || 'vertical'
      const isVertical = layout === 'vertical'
      const isGrid = layout === 'grid'
      const gridCols = Number(control?.gridCols) || 2

      for (let v = 0; v < valueSets.length; v++) {
        const valueSet = valueSets[v]
        newElements.push({
          ...anchorElement,
          value: '',
          type: ElementType.CONTROL,
          controlComponent: ControlComponent.CHECKBOX,
          checkbox: {
            code: valueSet.code,
            value: codes.includes(valueSet.code)
          }
        })
        const valueStrList = splitText(valueSet.value)
        for (let e = 0; e < valueStrList.length; e++) {
          const valChar = valueStrList[e]
          const isLastLetter = e === valueStrList.length - 1
          newElements.push({
            ...anchorElement,
            value: valChar === '\n' ? ZERO : valChar,
            letterSpacing: isLastLetter ? checkboxOption.gap : 0,
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
        }
      }
      draw.spliceElementList(elementList, insertAt, 0, newElements)
    }

    this.control.emitControlContentChange({
      context
    })
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (this.control.getIsDisabledControl()) {
      return null
    }
    const draw = this.control.getDraw()
    const isPreviewEdit = draw.getMode() === EditorMode.PREVIEW_EDIT
    const elementList = this.control.getElementList()
    const range = this.control.getRange()
    this.control.shrinkBoundary()
    const { startIndex, endIndex } = range
    const startElement = elementList[startIndex]
    const cId = startElement?.controlId || elementList[endIndex]?.controlId

    if (evt.key === KeyMap.Backspace) {
      if (startIndex !== endIndex) {
        // 选区删除
        draw.deleteElementList(
          elementList,
          startIndex + 1,
          endIndex - startIndex
        )
        const hasValue = elementList.some(
          el =>
            el.controlId === cId &&
            (el.controlComponent === ControlComponent.VALUE ||
              el.controlComponent === ControlComponent.CHECKBOX ||
              el.controlComponent === ControlComponent.RADIO)
        )
        if (!hasValue) {
          if (isPreviewEdit) {
            return this.control.removeControl(startIndex)
          } else {
            this.control.addPlaceholder(startIndex)
          }
        }
        return startIndex
      } else {
        if (
          startElement?.controlComponent === ControlComponent.PREFIX ||
          startElement?.controlComponent === ControlComponent.PLACEHOLDER
        ) {
          return this.control.removeControl(startIndex)
        } else if (
          startElement?.controlComponent === ControlComponent.VALUE ||
          startElement?.controlComponent === ControlComponent.CHECKBOX ||
          startElement?.controlComponent === ControlComponent.RADIO
        ) {
          // 逐字删除单字符
          draw.deleteElementList(elementList, startIndex, 1)
          const newIdx = Math.max(0, startIndex - 1)
          const hasValue = elementList.some(
            el =>
              el.controlId === cId &&
              (el.controlComponent === ControlComponent.VALUE ||
                el.controlComponent === ControlComponent.CHECKBOX ||
                el.controlComponent === ControlComponent.RADIO)
          )
          if (!hasValue) {
            if (isPreviewEdit) {
              return this.control.removeControl(newIdx)
            } else {
              this.control.addPlaceholder(newIdx)
              return newIdx
            }
          }
          return newIdx
        }
      }
    } else if (evt.key === KeyMap.Delete) {
      if (startIndex !== endIndex) {
        draw.deleteElementList(
          elementList,
          startIndex + 1,
          endIndex - startIndex
        )
        const hasValue = elementList.some(
          el =>
            el.controlId === cId &&
            (el.controlComponent === ControlComponent.VALUE ||
              el.controlComponent === ControlComponent.CHECKBOX ||
              el.controlComponent === ControlComponent.RADIO)
        )
        if (!hasValue) {
          if (isPreviewEdit) {
            return this.control.removeControl(startIndex)
          } else {
            this.control.addPlaceholder(startIndex)
          }
        }
        return startIndex
      } else {
        const nextIdx = endIndex + 1
        const nextElement = elementList[nextIdx]
        if (
          nextElement?.controlComponent === ControlComponent.VALUE ||
          nextElement?.controlComponent === ControlComponent.CHECKBOX ||
          nextElement?.controlComponent === ControlComponent.RADIO
        ) {
          draw.deleteElementList(elementList, nextIdx, 1)
          const hasValue = elementList.some(
            el =>
              el.controlId === cId &&
              (el.controlComponent === ControlComponent.VALUE ||
                el.controlComponent === ControlComponent.CHECKBOX ||
                el.controlComponent === ControlComponent.RADIO)
          )
          if (!hasValue) {
            if (isPreviewEdit) {
              return this.control.removeControl(endIndex)
            } else {
              this.control.addPlaceholder(endIndex)
              return endIndex
            }
          }
          return endIndex
        } else if (
          nextElement?.controlComponent === ControlComponent.POSTFIX &&
          !isPreviewEdit
        ) {
          return this.control.removeControl(endIndex)
        }
      }
    }
    return null
  }

  public cut(): number {
    return -1
  }
}
