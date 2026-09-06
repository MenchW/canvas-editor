import {
  ControlComponent,
  ControlState,
  ControlType
} from '../../../dataset/enum/Control'
import { EditorMode, EditorZone } from '../../../dataset/enum/Editor'
import { ElementType } from '../../../dataset/enum/Element'
import { LocationPosition } from '../../../dataset/enum/Common'
import { DeepRequired } from '../../../interface/Common'
import {
  IControl,
  IControlChangeOption,
  IControlChangeResult,
  IControlContentChangeResult,
  IControlContext,
  IControlHighlight,
  IControlInitOption,
  IControlInstance,
  IControlOption,
  IControlRuleOption,
  IDestroyControlOption,
  IGetControlValueOption,
  IGetControlValueResult,
  IInitNextControlOption,
  INextControlContext,
  IRepaintControlOption,
  ISetControlExtensionOption,
  ISetControlProperties,
  ISetControlRowFlexOption,
  ISetControlValueOption
} from '../../../interface/Control'
import { IEditorData, IEditorOption } from '../../../interface/Editor'
import { IElement, IElementPosition } from '../../../interface/Element'
import { EventBusMap } from '../../../interface/EventBus'
import { IRange } from '../../../interface/Range'
import {
  deepClone,
  omitObject,
  pickObject,
  splitText
} from '../../../utils'
import {
  formatElementContext,
  formatElementList,
  getNonHideElementIndex,
  isElementTraceDeleted,
  getOutermostOwner,
  pickElementAttr,
  scanToOwner,
  zipElementList
} from '../../../utils/element'
import { EventBus } from '../../event/eventbus/EventBus'
import { Listener } from '../../listener/Listener'
import { RangeManager } from '../../range/RangeManager'
import { Draw } from '../Draw'
import { CheckboxControl } from './checkbox/CheckboxControl'
import { RadioControl } from './radio/RadioControl'
import { ImageControl } from './image/ImageControl'
import { ListRadioControl } from './list/ListRadioControl'
import { ListCheckboxControl } from './list/ListCheckboxControl'
import { ListTextControl } from './list/ListTextControl'
import { ListImageControl } from './list/ListImageControl'
import { ControlSearch } from './interactive/ControlSearch'
import { ControlBorder } from './richtext/Border'
import { SelectControl } from './select/SelectControl'
import { TextControl } from './text/TextControl'
import { DateControl } from './date/DateControl'
import { NumberControl } from './number/NumberControl'
import { MoveDirection } from '../../../dataset/enum/Observer'
import {
  CONTROL_CONTEXT_ATTR,
  CONTROL_STYLE_ATTR,
  LIST_CONTEXT_ATTR,
  TITLE_CONTEXT_ATTR
} from '../../../dataset/constant/Element'
import { IRowElement } from '../../../interface/Row'
import { RowFlex } from '../../../dataset/enum/Row'
import { ZERO } from '../../../dataset/constant/Common'

interface IMoveCursorResult {
  newIndex: number
  newElement: IElement
}
export class Control {
  private controlBorder: ControlBorder
  private draw: Draw
  private range: RangeManager
  private listener: Listener
  private eventBus: EventBus<EventBusMap>
  private controlSearch: ControlSearch
  private options: DeepRequired<IEditorOption>
  private controlOptions: IControlOption
  private activeControl: IControlInstance | null
  private activeControlValue: IElement[]
  private preElement: IElement | null

  constructor(draw: Draw) {
    this.controlBorder = new ControlBorder(draw)

    this.draw = draw
    this.range = draw.getRange()
    this.listener = draw.getListener()
    this.eventBus = draw.getEventBus()
    this.controlSearch = new ControlSearch(this)

    this.options = draw.getOptions()
    this.controlOptions = this.options.control
    this.activeControl = null
    this.activeControlValue = []
    this.preElement = null
  }

  // 搜索高亮匹配
  public setHighlightList(payload: IControlHighlight[]) {
    this.controlSearch.setHighlightList(payload)
  }

  public computeHighlightList() {
    const highlightList = this.controlSearch.getHighlightList()
    if (highlightList.length) {
      this.controlSearch.computeHighlightList()
    }
  }

  public renderHighlightList(ctx: CanvasRenderingContext2D, pageNo: number) {
    const highlightMatchResult = this.controlSearch.getHighlightMatchResult()
    if (highlightMatchResult.length) {
      this.controlSearch.renderHighlightList(ctx, pageNo)
    }
  }

  public getDraw(): Draw {
    return this.draw
  }

  // 过滤控件辅助元素（前后缀、背景提示）
  public filterAssistElement(elementList: IElement[]): IElement[] {
    // 打印模式配置
    const { filterEmptyControl } = this.options.modeRule[EditorMode.PRINT]

    return elementList.filter((element, index) => {
      if (element.type === ElementType.TABLE) {
        const trList = element.trList!
        for (let r = 0; r < trList.length; r++) {
          const tr = trList[r]
          for (let d = 0; d < tr.tdList.length; d++) {
            const td = tr.tdList[d]
            td.value = this.filterAssistElement(td.value)
          }
        }
      }
      if (!element.controlId) return true
      if (element.isControlMinWidthPlaceholder) return false
      if (element.control?.minWidth) {
        if (
          element.controlComponent === ControlComponent.PREFIX ||
          element.controlComponent === ControlComponent.POSTFIX
        ) {
          element.value = ''
          return true
        }
      } else {
        // 控件存在值时无需过滤前后文本
        if (
          element.control?.preText &&
          element.controlComponent === ControlComponent.PRE_TEXT
        ) {
          let isExistValue = false
          let start = index + 1
          while (start < elementList.length) {
            const nextElement = elementList[start]
            if (element.controlId !== nextElement.controlId) break
            if (nextElement.controlComponent === ControlComponent.VALUE) {
              isExistValue = true
              break
            }
            start++
          }
          return isExistValue
        }
        if (
          element.control?.postText &&
          element.controlComponent === ControlComponent.POST_TEXT
        ) {
          let isExistValue = false
          let start = index - 1
          while (start >= 0) {
            const preElement = elementList[start]
            if (element.controlId !== preElement.controlId) break
            if (preElement.controlComponent === ControlComponent.VALUE) {
              isExistValue = true
              break
            }
            start--
          }
          return isExistValue
        }
      }
      return (
        element.controlComponent !== ControlComponent.PREFIX &&
        element.controlComponent !== ControlComponent.POSTFIX &&
        (!filterEmptyControl ||
          (element.controlComponent !== ControlComponent.PLACEHOLDER &&
            !element.isPlaceholder))
      )
    })
  }

  // 是否属于控件可以捕获事件的选区
  public getIsRangeCanCaptureEvent(): boolean {
    if (!this.activeControl) return false
    const { startIndex, endIndex } = this.getRange()
    if (!~startIndex && !~endIndex) return false
    const elementList = this.getElementList()
    const startElement = elementList[startIndex]
    // 闭合光标在后缀处
    if (
      startIndex === endIndex &&
      startElement.controlComponent === ControlComponent.POSTFIX
    ) {
      return true
    }
    // 在控件内（嵌套下，选区起止可能属于同一最外层控件的不同子控件）
    const endElement = elementList[endIndex]
    const startOuter = getOutermostOwner(elementList, startIndex)
    const endOuter = getOutermostOwner(elementList, endIndex)
    if (
      startOuter &&
      startOuter === endOuter &&
      endElement.controlComponent !== ControlComponent.POSTFIX
    ) {
      return true
    }
    return false
  }

  // 判断选区是否在后缀处
  public getIsRangeInPostfix(): boolean {
    if (!this.activeControl) return false
    const { startIndex, endIndex } = this.getRange()
    if (startIndex !== endIndex) return false
    const elementList = this.getElementList()
    const element = elementList[startIndex]
    return element.controlComponent === ControlComponent.POSTFIX
  }

  // 判断选区是否在控件内
  public getIsRangeWithinControl(): boolean {
    const { startIndex, endIndex } = this.getRange()
    if (!~startIndex && !~endIndex) return false
    const elementList = this.getElementList()
    const endElement = elementList[endIndex]
    // 嵌套下，选区起止可能属于同一最外层控件的不同子控件
    const startOuter = getOutermostOwner(elementList, startIndex)
    const endOuter = getOutermostOwner(elementList, endIndex)
    if (
      startOuter &&
      startOuter === endOuter &&
      endElement.controlComponent !== ControlComponent.POSTFIX
    ) {
      return true
    }
    return false
  }

  // 是否元素包含完整控件元素
  public getIsElementListContainFullControl(elementList: IElement[]): boolean {
    if (!elementList.some(element => element.controlId)) return false
    let prefixCount = 0
    let postfixCount = 0
    for (let e = 0; e < elementList.length; e++) {
      const element = elementList[e]
      if (element.controlComponent === ControlComponent.PREFIX) {
        prefixCount++
      } else if (element.controlComponent === ControlComponent.POSTFIX) {
        postfixCount++
      }
    }
    if (!prefixCount || !postfixCount) return false
    return prefixCount === postfixCount
  }

  public getIsDisabledControl(context: IControlContext = {}): boolean {
    if (this.draw.isDesignMode() || !this.activeControl) return false
    const { startIndex, endIndex } = context.range || this.range.getRange()
    if (startIndex === endIndex && ~startIndex && ~endIndex) {
      const elementList = context.elementList || this.getElementList()
      const startElement = elementList[startIndex]
      if (startElement.controlComponent === ControlComponent.POSTFIX) {
        return false
      }
    }
    return !!this.activeControl.getElement()?.control?.disabled
  }

  public getIsDisabledPasteControl(context: IControlContext = {}): boolean {
    if (this.draw.isDesignMode() || !this.activeControl) return false
    const { startIndex, endIndex } = context.range || this.range.getRange()
    if (startIndex === endIndex && ~startIndex && ~endIndex) {
      const elementList = context.elementList || this.getElementList()
      const startElement = elementList[startIndex]
      if (startElement.controlComponent === ControlComponent.POSTFIX) {
        return false
      }
    }
    return !!this.activeControl.getElement()?.control?.pasteDisabled
  }

  // 通过索引找到控件并判断控件是否存在值
  public getIsExistValueByElementListIndex(
    elementList: IElement[],
    index: number
  ): boolean {
    const element = elementList[index]
    // 是否是控件
    if (!element.controlId) return false
    // 单选框、复选框仅需验证控件值
    if (
      element.control?.type === ControlType.CHECKBOX ||
      element.control?.type === ControlType.RADIO
    ) {
      return !!element.control?.code
    }
    // 其他控件需校验文本
    if (element.controlComponent === ControlComponent.VALUE) {
      return true
    }
    if (element.controlComponent === ControlComponent.PLACEHOLDER) {
      return false
    }
    // 向后查找值元素
    if (
      element.controlComponent === ControlComponent.PREFIX ||
      element.controlComponent === ControlComponent.PRE_TEXT
    ) {
      let i = index
      while (i < elementList.length) {
        const next = scanToOwner(elementList, i, 1, element.controlId!)
        if (next < 0 || next >= elementList.length) return false
        const nextElement = elementList[next]
        if (nextElement.controlId !== element.controlId) {
          return false
        }
        if (nextElement.controlComponent === ControlComponent.VALUE) {
          return true
        }
        if (nextElement.controlComponent === ControlComponent.PLACEHOLDER) {
          return false
        }
        i = next
      }
    }
    // 向前查找值元素
    if (
      element.controlComponent === ControlComponent.POSTFIX ||
      element.controlComponent === ControlComponent.POST_TEXT
    ) {
      let i = index
      while (i >= 0) {
        const next = scanToOwner(elementList, i, -1, element.controlId!)
        if (next < 0) return false
        const preElement = elementList[next]
        if (preElement.controlId !== element.controlId) {
          return false
        }
        if (preElement.controlComponent === ControlComponent.VALUE) {
          return true
        }
        if (preElement.controlComponent === ControlComponent.PLACEHOLDER) {
          return false
        }
        i = next
      }
    }
    return false
  }

  public getControlHighlight(elementList: IElement[], index: number) {
    return this.controlSearch.getControlHighlight(elementList, index)
  }

  public getContainer(): HTMLDivElement {
    return this.draw.getContainer()
  }

  public getElementList(): IElement[] {
    return this.draw.getElementList()
  }

  public getPosition(): IElementPosition | null {
    const positionList = this.draw.getPosition().getPositionList()
    const { endIndex } = this.range.getRange()
    return positionList[endIndex] || null
  }

  public getPreY(): number {
    const height = this.draw.getHeight()
    const pageGap = this.draw.getPageGap()
    const pageNo = this.getPosition()?.pageNo ?? this.draw.getPageNo()
    return pageNo * (height + pageGap)
  }

  public getRange(): IRange {
    return this.range.getRange()
  }

  public getValueRange(context: IControlContext = {}): IRange | null {
    const elementList = context.elementList || this.getElementList()
    const { startIndex } = context.range || this.getRange()
    const startElement = elementList[startIndex]
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
        preIndex = next
        break
      }
      preIndex = next
    }
    // 向右查找
    let nextIndex = startIndex
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
      nextIndex = next
    }
    if (preIndex === nextIndex) return null
    return {
      startIndex: preIndex,
      endIndex: nextIndex
    }
  }

  public shrinkBoundary(context: IControlContext = {}) {
    this.range.shrinkBoundary(context)
  }

  public getActiveControl(): IControlInstance | null {
    return this.activeControl
  }

  public getControlElementList(context: IControlContext = {}): IElement[] {
    const elementList = context.elementList || this.getElementList()
    const { startIndex } = context.range || this.getRange()
    const startElement = elementList[startIndex]
    if (!startElement?.controlId) return []
    const data: IElement[] = [startElement]
    // 向左查找
    let preIndex = startIndex
    while (preIndex > 0) {
      const next = scanToOwner(
        elementList,
        preIndex,
        -1,
        startElement.controlId
      )
      if (next < 0) break
      const preElement = elementList[next]
      if (preElement.controlId !== startElement.controlId) break
      data.unshift(preElement)
      preIndex = next
    }
    // 向右查找（从 startIndex 开始：scanToOwner 内部从 index+direction 起查）
    let nextIndex = startIndex
    while (nextIndex < elementList.length) {
      const next = scanToOwner(
        elementList,
        nextIndex,
        1,
        startElement.controlId
      )
      if (next < 0 || next >= elementList.length) break
      const nextElement = elementList[next]
      if (nextElement.controlId !== startElement.controlId) break
      data.push(nextElement)
      nextIndex = next
    }
    return data
  }

  public updateActiveControlValue() {
    if (this.activeControl) {
      this.activeControlValue = this.getControlElementList()
    }
  }

  public emitControlChange(state: ControlState) {
    if (!this.activeControl) return
    const isSubscribeControlChange = this.eventBus.isSubscribe('controlChange')
    if (!this.listener.controlChange && !isSubscribeControlChange) return
    let control: IControl | undefined
    const value = this.activeControlValue
    const activeElement = this.activeControl.getElement()
    if (value?.length) {
      try {
        const zipList = zipElementList(value)
        control = zipList.find(el => el.control)?.control
      } catch {
        // ignore zip error
      }
    }
    if (!control) {
      control =
        pickElementAttr(deepClone(activeElement)).control ||
        deepClone((this.activeControl as any)?.getControl?.())
    }
    if (!control) return
    if (!control.value) {
      control.value = []
    }
    const payload: IControlChangeResult = {
      state,
      control,
      controlId: activeElement.controlId!
    }
    this.listener.controlChange?.(payload)
    if (isSubscribeControlChange) {
      this.eventBus.emit('controlChange', payload)
    }
  }

  public initControl() {
    const elementList = this.getElementList()
    const range = this.getRange()
    const element = elementList[range.startIndex]
    // 判断控件是否已经激活
    if (this.activeControl) {
      // 弹窗类控件唤醒弹窗，后缀处移除弹窗
      if (
        this.activeControl instanceof SelectControl ||
        this.activeControl instanceof DateControl ||
        this.activeControl instanceof NumberControl
      ) {
        if (element.controlComponent === ControlComponent.POSTFIX) {
          this.activeControl.destroy()
        } else {
          this.activeControl.awake()
        }
      }
      // 相同控件元素
      if (this.preElement?.controlId === element.controlId) {
        // 当前元素在尾部：控件失活事件
        if (element.controlComponent === ControlComponent.POSTFIX) {
          this.emitControlChange(ControlState.INACTIVE)
        } else if (
          // 之前元素在尾部 && 当前不在尾部：控件激活事件
          this.preElement?.controlComponent === ControlComponent.POSTFIX
        ) {
          this.emitControlChange(ControlState.ACTIVE)
        }
      }
      // 更新缓存控件数据
      const controlElement = this.activeControl.getElement()
      if (element.controlId === controlElement.controlId) {
        this.updateActiveControlValue()
        this.preElement = element
        return
      }
    }
    // 销毁旧激活控件
    this.destroyControl()
    // 激活控件
    const isReadonly = this.draw.isReadonly()
    if (isReadonly || !element?.control) return
    const control = element.control
    const rawType = (control.type || '').toLowerCase()
    const listType = (control.listType || '').toLowerCase()
    const isList = Boolean(listType)

    let effectiveType = rawType
    if (rawType === 'list' || !rawType) {
      if (listType === 'radio') effectiveType = ControlType.RADIO
      else if (listType === 'checkbox') effectiveType = ControlType.CHECKBOX
      else if (listType === 'image') effectiveType = ControlType.IMAGE
      else effectiveType = ControlType.TEXT
    }

    if (effectiveType === ControlType.TEXT) {
      this.activeControl = isList
        ? new ListTextControl(element, this)
        : new TextControl(element, this)
    } else if (effectiveType === ControlType.SELECT) {
      const selectControl = new SelectControl(element, this)
      this.activeControl = selectControl
      selectControl.awake()
    } else if (effectiveType === ControlType.CHECKBOX) {
      this.activeControl = isList
        ? new ListCheckboxControl(element, this)
        : new CheckboxControl(element, this)
    } else if (effectiveType === ControlType.RADIO) {
      this.activeControl = isList
        ? new ListRadioControl(element, this)
        : new RadioControl(element, this)
    } else if (effectiveType === ControlType.IMAGE) {
      this.activeControl = isList
        ? new ListImageControl(element, this)
        : new ImageControl(element, this)
    } else if (effectiveType === ControlType.DATE) {
      const dateControl = new DateControl(element, this)
      this.activeControl = dateControl
      dateControl.awake()
    } else if (effectiveType === ControlType.NUMBER) {
      const numberControl = new NumberControl(element, this)
      this.activeControl = numberControl
      numberControl.awake()
    }
    // 缓存控件数据
    this.updateActiveControlValue()
    this.preElement = element
    // 激活控件回调
    if (element.controlComponent !== ControlComponent.POSTFIX) {
      this.emitControlChange(ControlState.ACTIVE)
    }
  }

  public destroyControl(options: IDestroyControlOption = {}) {
    if (!this.activeControl) return
    const { isEmitEvent = true } = options
    if (
      this.activeControl instanceof SelectControl ||
      this.activeControl instanceof DateControl ||
      this.activeControl instanceof NumberControl
    ) {
      this.activeControl.destroy()
    }
    // 销毁控件回调
    if (
      isEmitEvent &&
      this.preElement?.controlComponent !== ControlComponent.POSTFIX
    ) {
      this.emitControlChange(ControlState.INACTIVE)
    }
    // 清空变量
    this.preElement = null
    this.activeControl = null
    this.activeControlValue = []
  }

  public repaintControl(options: IRepaintControlOption = {}) {
    const {
      curIndex,
      isCompute = true,
      isSubmitHistory = true,
      isSetCursor = true
    } = options
    // 重新渲染
    if (curIndex === undefined) {
      this.range.clearRange()
      this.draw.render({
        isCompute,
        isSubmitHistory,
        isSetCursor: false
      })
    } else {
      this.range.setRange(curIndex, curIndex)
      this.draw.render({
        curIndex,
        isCompute,
        isSetCursor,
        isSubmitHistory
      })
    }
  }

  public emitControlContentChange(options?: IControlChangeOption) {
    const isSubscribeControlContentChange = this.eventBus.isSubscribe(
      'controlContentChange'
    )
    if (
      !isSubscribeControlContentChange &&
      !this.listener.controlContentChange
    ) {
      return
    }
    const controlElement =
      options?.controlElement || this.activeControl?.getElement()
    if (!controlElement) return
    // 控件被删除不触发事件
    const elementList = options?.context?.elementList || this.getElementList()
    const { startIndex } = options?.context?.range || this.getRange()
    if (!elementList[startIndex]?.controlId) return
    // 格式化回调数据
    const controlValue =
      options?.controlValue || this.getControlElementList(options?.context)
    let control: IControl | undefined
    if (controlValue?.length) {
      const zipped = zipElementList(controlValue)
      control = zipped[0]?.control || controlElement.control
    } else {
      control = controlElement.control
      if (control) {
        control.value = []
      }
    }
    if (!control) return
    const payload: IControlContentChangeResult = {
      control,
      controlId: controlElement.controlId!
    }
    const tCb0 = performance.now()
    this.listener.controlContentChange?.(payload)
    if (isSubscribeControlContentChange) {
      this.eventBus.emit('controlContentChange', payload)
    }
    const tCb = performance.now() - tCb0
    if (tCb > 1) {
      console.log(
        `%c[ControlChange Listener]%c id=${controlElement.controlId} callback耗时: ${tCb.toFixed(1)}ms`,
        'color: #ff5722; font-weight: bold',
        'color: inherit'
      )
    }
  }

  public reAwakeControl() {
    if (!this.activeControl) return
    const elementList = this.getElementList()
    const range = this.getRange()
    const element = elementList[range.startIndex]
    this.activeControl.setElement(element)
    if (
      (this.activeControl instanceof DateControl ||
        this.activeControl instanceof SelectControl ||
        this.activeControl instanceof NumberControl) &&
      this.activeControl.getIsPopup()
    ) {
      this.activeControl.destroy()
      this.activeControl.awake()
    }
  }

  public selectValue(): boolean {
    const elementList = this.getElementList()
    const { startIndex } = this.getRange()
    const startElement = elementList[startIndex]
    if (
      !startElement?.controlId ||
      (startElement.controlComponent !== ControlComponent.VALUE &&
        elementList[startIndex + 1]?.controlComponent ===
          ControlComponent.VALUE)
    ) {
      return false
    }
    // 向左查找
    let preIndex = startIndex
    while (preIndex > 0) {
      const preElement = elementList[preIndex]
      if (preElement.controlComponent !== ControlComponent.VALUE) break
      preIndex--
    }
    // 向右查找
    let nextIndex = startIndex + 1
    while (nextIndex < elementList.length) {
      const nextElement = elementList[nextIndex]
      if (nextElement.controlComponent !== ControlComponent.VALUE) {
        nextIndex--
        break
      }
      nextIndex++
    }
    if (preIndex !== nextIndex) {
      const range = this.range.getRange()
      this.range.replaceRange({
        ...range,
        startIndex: preIndex,
        endIndex: nextIndex
      })
      this.draw.render({
        isCompute: false,
        isSetCursor: false,
        isSubmitHistory: false
      })
      return true
    }
    return false
  }

  public moveCursor(position: IControlInitOption): IMoveCursorResult {
    const { index, trIndex, tdIndex, tdValueIndex } = position
    let elementList = this.draw.getOriginalElementList()
    let element: IElement
    const newIndex = position.isTable ? tdValueIndex! : index
    if (position.isTable) {
      elementList = elementList[index!].trList![trIndex!].tdList[tdIndex!].value
      element = elementList[tdValueIndex!]
    } else {
      element = elementList[index]
    }
    const traceParticle = this.draw.getTraceParticle()
    // 隐藏元素移动光标（设计模式下允许选中）
    if (
      !this.draw.isDesignMode() &&
      (element.hide ||
        element.control?.hide ||
        element.area?.hide ||
        traceParticle.isTraceHidden(element))
    ) {
      const nonHideIndex = getNonHideElementIndex(
        elementList,
        newIndex,
        LocationPosition.BEFORE,
        el => traceParticle.isTraceHidden(el)
      )
      return {
        newIndex: nonHideIndex,
        newElement: elementList[nonHideIndex]
      }
    }
    // 控件内移动光标
    const isPreviewEdit = this.draw.getMode() === EditorMode.PREVIEW_EDIT
    if (isPreviewEdit && element.controlId) {
      const hasValue = elementList.some(
        el =>
          el.controlId === element.controlId &&
          el.controlComponent === ControlComponent.VALUE
      )
      if (!hasValue) {
        // 无痕模式下未填值的空控件：光标统一定位到该控件首个节点
        const firstControlIndex = elementList.findIndex(
          el => el.controlId === element.controlId
        )
        if (~firstControlIndex) {
          return {
            newIndex: firstControlIndex,
            newElement: elementList[firstControlIndex]
          }
        }
      }
    }

    if (element.controlComponent === ControlComponent.VALUE) {
      // VALUE-无需移动
      return {
        newIndex,
        newElement: element
      }
    } else if (element.controlComponent === ControlComponent.POSTFIX) {
      // POSTFIX-移动到最后一个后缀字符后
      let startIndex = newIndex + 1
      while (startIndex < elementList.length) {
        const nextElement = elementList[startIndex]
        if (nextElement.controlId !== element.controlId) {
          return {
            newIndex: startIndex - 1,
            newElement: elementList[startIndex - 1]
          }
        }
        // 全文最后一个元素时移动后缀尾部
        if (startIndex === elementList.length - 1) {
          return {
            newIndex: startIndex,
            newElement: elementList[startIndex]
          }
        }
        startIndex++
      }
    } else if (
      element.controlComponent === ControlComponent.PREFIX ||
      element.controlComponent === ControlComponent.PRE_TEXT
    ) {
      // PREFIX或前文本-移动到最后一个前缀字符后
      let startIndex = newIndex + 1
      while (startIndex < elementList.length) {
        const nextElement = elementList[startIndex]
        if (
          nextElement.controlId !== element.controlId ||
          (nextElement.controlComponent !== ControlComponent.PREFIX &&
            nextElement.controlComponent !== ControlComponent.PRE_TEXT)
        ) {
          return {
            newIndex: startIndex - 1,
            newElement: elementList[startIndex - 1]
          }
        }
        startIndex++
      }
    } else if (
      element.controlComponent === ControlComponent.PLACEHOLDER ||
      element.controlComponent === ControlComponent.POST_TEXT
    ) {
      // PLACEHOLDER或后文本-移动到第一个前缀或内容后
      let startIndex = newIndex - 1
      while (startIndex >= 0) {
        const preElement = elementList[startIndex]
        if (
          preElement.controlId !== element.controlId ||
          preElement.controlComponent === ControlComponent.VALUE ||
          preElement.controlComponent === ControlComponent.PREFIX ||
          preElement.controlComponent === ControlComponent.PRE_TEXT
        ) {
          return {
            newIndex: startIndex,
            newElement: elementList[startIndex]
          }
        }
        startIndex--
      }
      // 前方无前缀时保底返回当前控件首节点
      const firstControlIndex = elementList.findIndex(
        el => el.controlId === element.controlId
      )
      const safeIndex = ~firstControlIndex ? firstControlIndex : 0
      return {
        newIndex: safeIndex,
        newElement: elementList[safeIndex] || element
      }
    }
    return {
      newIndex,
      newElement: element
    }
  }

  // 查找控件前缀/前文本段的起始位置（支持多字符前缀/前文本）
  public getControlStartIndex(
    elementList: IElement[],
    startIndex: number,
    controlId: string
  ): number {
    let index = startIndex
    while (
      index > 0 &&
      elementList[index - 1]?.controlId === controlId &&
      (elementList[index - 1]?.controlComponent === ControlComponent.PREFIX ||
        elementList[index - 1]?.controlComponent === ControlComponent.PRE_TEXT)
    ) {
      index--
    }
    return index
  }

  // 查找控件后文本/后缀段的结束位置（支持多字符后文本/后缀）
  public getControlEndIndex(
    elementList: IElement[],
    startIndex: number,
    controlId: string
  ): number {
    let index = startIndex
    while (
      index < elementList.length - 1 &&
      elementList[index + 1]?.controlId === controlId &&
      (elementList[index + 1]?.controlComponent ===
        ControlComponent.POST_TEXT ||
        elementList[index + 1]?.controlComponent === ControlComponent.POSTFIX)
    ) {
      index++
    }
    return index
  }

  public removeControl(
    startIndex: number,
    context: IControlContext = {}
  ): number | null {
    const elementList = context.elementList || this.getElementList()
    if (startIndex < 0 || startIndex >= elementList.length) return null
    const startElement = elementList[startIndex]
    if (!startElement) return null

    // 设计模式 || 元素隐藏 => 不验证删除权限
    if (
      !this.draw.isDesignMode() &&
      !startElement.hide &&
      !startElement.control?.hide &&
      !startElement.area?.hide
    ) {
      const { deletable = true } = startElement.control || {}
      if (!deletable) return null
      // 表单模式控件删除权限验证
      const mode = this.draw.getMode()
      if (
        mode === EditorMode.FORM &&
        this.options.modeRule[mode].controlDeletableDisabled
      ) {
        return null
      }
      // 外层删除时，递归校验内部所有子控件的 deletable
      const ownerId = startElement.controlId
      if (ownerId) {
        let scanIndex = startIndex
        while (scanIndex < elementList.length) {
          const scanEl = elementList[scanIndex]
          if (!scanEl) {
            scanIndex++
            continue
          }
          // 找到外层 POSTFIX 即结束
          if (
            scanEl.controlId === ownerId &&
            scanEl.controlComponent === ControlComponent.POSTFIX
          ) {
            break
          }
          // 遇到内层控件段 PREFIX，检查该内层控件的 deletable
          if (
            scanEl.controlId !== ownerId &&
            scanEl.controlComponent === ControlComponent.PREFIX &&
            scanEl.control?.deletable === false
          ) {
            return null
          }
          scanIndex++
        }
      }
    }
    let leftIndex = -1
    let rightIndex = -1
    // 向左查找（嵌套感知：跳过内层段落）
    let preIndex = startIndex
    // 起点本身是外层 PREFIX / PRE_TEXT 即为左边界
    if (
      startElement.controlComponent === ControlComponent.PREFIX ||
      startElement.controlComponent === ControlComponent.PRE_TEXT
    ) {
      const start = this.getControlStartIndex(
        elementList,
        preIndex,
        startElement.controlId!
      )
      leftIndex = start - 1
    } else {
      while (preIndex > 0) {
        const next = scanToOwner(
          elementList,
          preIndex,
          -1,
          startElement.controlId!
        )
        if (next < 0) break
        const preElement = elementList[next]
        if (preElement.controlId !== startElement.controlId) {
          leftIndex = next
          break
        }
        // 落到外层 PREFIX / PRE_TEXT 即为左边界
        if (
          preElement.controlComponent === ControlComponent.PREFIX ||
          preElement.controlComponent === ControlComponent.PRE_TEXT
        ) {
          const start = this.getControlStartIndex(
            elementList,
            next,
            startElement.controlId!
          )
          leftIndex = start - 1
          break
        }
        preIndex = next
      }
    }
    // 向右查找（嵌套感知：跳过内层段落）
    let nextIndex = startIndex
    // 起点本身是外层 POSTFIX / POST_TEXT 即为右边界
    if (
      startElement.controlComponent === ControlComponent.POSTFIX ||
      startElement.controlComponent === ControlComponent.POST_TEXT
    ) {
      rightIndex = this.getControlEndIndex(
        elementList,
        nextIndex,
        startElement.controlId!
      )
    } else {
      while (nextIndex < elementList.length) {
        const curElement = elementList[nextIndex]
        // 落到外层 POSTFIX / POST_TEXT 即为右边界
        if (
          curElement.controlComponent === ControlComponent.POSTFIX ||
          curElement.controlComponent === ControlComponent.POST_TEXT
        ) {
          rightIndex = this.getControlEndIndex(
            elementList,
            nextIndex,
            startElement.controlId!
          )
          break
        }
        const next = scanToOwner(
          elementList,
          nextIndex,
          1,
          startElement.controlId!
        )
        if (next >= elementList.length) {
          rightIndex = next - 1
          break
        }
        nextIndex = next
      }
    }
    // 控件在最后
    if (!~leftIndex && !~rightIndex) {
      // 兜底扫描：若控件无显式前后缀（如图片控件），计算所有相同 controlId 元素的最小与最大索引
      let minIdx = startIndex
      let maxIdx = startIndex
      for (let i = 0; i < elementList.length; i++) {
        if (elementList[i]?.controlId === startElement.controlId) {
          if (i < minIdx) minIdx = i
          if (i > maxIdx) maxIdx = i
        }
      }
      leftIndex = minIdx - 1
      rightIndex = maxIdx
    }
    const deleteStart = leftIndex + 1
    const deleteCount = rightIndex - leftIndex
    if (deleteStart >= 0 && deleteCount > 0) {
      this.draw.deleteElementList(
        elementList,
        deleteStart,
        deleteCount
      )
    }
    return Math.max(0, leftIndex)
  }

  public removePlaceholder(startIndex: number, context: IControlContext = {}) {
    const elementList = context.elementList || this.getElementList()
    const startElement = elementList[startIndex]
    const nextElement = elementList[startIndex + 1]
    const targetControlId =
      startElement?.controlId || nextElement?.controlId
    if (!targetControlId) return

    let prefixIndex = -1
    let placeholderCount = 0

    for (let i = 0; i < elementList.length; i++) {
      const el = elementList[i]
      if (el?.controlId === targetControlId) {
        if (el.controlComponent === ControlComponent.PREFIX) {
          prefixIndex = i
        }
        if (el.controlComponent === ControlComponent.PLACEHOLDER) {
          placeholderCount++
        }
      }
    }

    if (placeholderCount > 0) {
      this.draw.getHistoryManager().popUndo()
      this.draw.submitHistory(startIndex)

      for (let i = elementList.length - 1; i >= 0; i--) {
        const el = elementList[i]
        if (
          el?.controlId === targetControlId &&
          el.controlComponent === ControlComponent.PLACEHOLDER
        ) {
          elementList.splice(i, 1)
        }
      }

      const rangeManager = this.draw.getRange()
      const currentRange = context.range || rangeManager.getRange()
      if (prefixIndex !== -1) {
        currentRange.startIndex = prefixIndex
        currentRange.endIndex = prefixIndex
        if (!context.range) {
          rangeManager.setRange(prefixIndex, prefixIndex)
        }
      }
    }
  }

  public removePlaceholderInRange(
    elementList: IElement[],
    startIndex: number,
    count: number
  ): number {
    for (let i = startIndex + count - 1; i >= startIndex; i--) {
      if (elementList[i]?.controlComponent === ControlComponent.PLACEHOLDER) {
        elementList.splice(i, 1)
        count--
      }
    }
    return count
  }

  public addPlaceholder(startIndex: number, context: IControlContext = {}) {
    const elementList = context.elementList || this.getElementList()
    const startElement = elementList[startIndex]
    if (!startElement?.control) return
    const control = startElement.control
    if (!control.placeholder) return
    const placeholderStrList = splitText(control.placeholder)
    // 优先使用默认控件样式
    const anchorElementStyleAttr = pickObject(startElement, CONTROL_STYLE_ATTR)
    for (let p = 0; p < placeholderStrList.length; p++) {
      const value = placeholderStrList[p]
      const newElement: IElement = {
        ...anchorElementStyleAttr,
        value: value === '\n' ? ZERO : value,
        controlId: startElement.controlId,
        type: ElementType.CONTROL,
        control: startElement.control,
        controlComponent: ControlComponent.PLACEHOLDER,
        color: this.controlOptions.placeholderColor
      }
      formatElementContext(elementList, [newElement], startIndex, {
        editorOptions: this.options
      })
      this.draw.spliceElementList(elementList, startIndex + p + 1, 0, [
        newElement
      ])
    }
  }

  public setValue(data: IElement[]): number {
    if (!this.activeControl) {
      throw new Error('active control is null')
    }
    return this.activeControl.setValue(data)
  }

  public setControlProperties(
    properties: Partial<IControl>,
    context: IControlContext = {}
  ) {
    const elementList = context.elementList || this.getElementList()
    const { startIndex } = context.range || this.getRange()
    const startElement = elementList[startIndex]
    startElement.control = {
      ...startElement.control!,
      ...properties
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
      if (preElement.controlId !== startElement.controlId) break
      preElement.control = {
        ...preElement.control!,
        ...properties
      }
      preIndex = next
    }
    // 向右查找（scanToOwner 从给定索引的下一位开始扫描，
    let nextIndex = startIndex
    while (nextIndex < elementList.length) {
      const next = scanToOwner(
        elementList,
        nextIndex,
        1,
        startElement.controlId!
      )
      if (next < 0 || next >= elementList.length) break
      const nextElement = elementList[next]
      if (nextElement.controlId !== startElement.controlId) break
      nextElement.control = {
        ...nextElement.control!,
        ...properties
      }
      nextIndex = next
    }
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (!this.activeControl) {
      throw new Error('active control is null')
    }
    return this.activeControl.keydown(evt)
  }

  public cut(): number {
    if (!this.activeControl) {
      throw new Error('active control is null')
    }
    return this.activeControl.cut()
  }

  public getValueById(payload: IGetControlValueOption): IGetControlValueResult {
    const { id, groupId, conceptId, areaId } = payload
    const result: IGetControlValueResult = []
    if (!id && !conceptId && !groupId) return result
    const getValue = (elementList: IElement[], zone: EditorZone) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        // 表格下钻处理
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              getValue(td.value, zone)
            }
          }
        }
        if (
          !element.control ||
          (groupId && element.control.groupId !== groupId) ||
          (id && element.controlId !== id) ||
          (conceptId && element.control.conceptId !== conceptId) ||
          (areaId && element.areaId !== areaId)
        ) {
          continue
        }
        const { type, code, valueSets } = element.control
        let j = i
        let textControlValue = ''
        const textControlElementList = []
        let hasVisibleControlElement = !isElementTraceDeleted(element)
        while (j < elementList.length) {
          const nextElement = elementList[j]
          if (nextElement.controlId !== element.controlId) break
          const isDeleted = isElementTraceDeleted(nextElement)
          if (!isDeleted) hasVisibleControlElement = true
          if (
            !isDeleted &&
            (type === ControlType.TEXT ||
              type === ControlType.DATE ||
              type === ControlType.NUMBER) &&
            nextElement.controlComponent === ControlComponent.VALUE
          ) {
            textControlValue += nextElement.value
            textControlElementList.push(
              omitObject(nextElement, CONTROL_CONTEXT_ATTR)
            )
          }
          j++
        }
        if (!hasVisibleControlElement) {
          i = j
          continue
        }
        if (
          type === ControlType.TEXT ||
          type === ControlType.DATE ||
          type === ControlType.NUMBER
        ) {
          result.push({
            ...element.control,
            zone,
            value: textControlValue || null,
            innerText: textControlValue || null,
            elementList: zipElementList(textControlElementList)
          })
        } else if (
          type === ControlType.SELECT ||
          type === ControlType.CHECKBOX ||
          type === ControlType.RADIO
        ) {
          const innerText = code
            ?.split(',')
            .map(
              selectCode =>
                valueSets?.find(valueSet => valueSet.code === selectCode)?.value
            )
            .filter(Boolean)
            .join('')
          result.push({
            ...element.control,
            zone,
            value: code || null,
            innerText: innerText || null
          })
        }
        i = j
      }
    }
    const data = [
      {
        zone: EditorZone.HEADER,
        elementList: this.draw.getHeaderElementList()
      },
      {
        zone: EditorZone.MAIN,
        elementList: this.draw.getOriginalMainElementList()
      },
      {
        zone: EditorZone.FOOTER,
        elementList: this.draw.getFooterElementList()
      }
    ]
    for (const { zone, elementList } of data) {
      getValue(elementList, zone)
    }
    return result
  }

  public setValueListById(payload: ISetControlValueOption[]) {
    if (!payload.length) return
    let isExistSet = false
    let isExistSubmitHistory = false

    // 构建 Payload 快速索引 Map，实现 O(1) 检索
    const idMap = new Map<string, ISetControlValueOption>()
    const conceptIdMap = new Map<string, ISetControlValueOption>()
    const areaIdMap = new Map<string, ISetControlValueOption>()
    for (const p of payload) {
      if (p.id) idMap.set(p.id, p)
      if (p.areaId) areaIdMap.set(p.areaId, p)
      if (p.conceptId) {
        conceptIdMap.set(p.conceptId, p)
        conceptIdMap.set(p.conceptId.replace(/\./g, '_'), p)
        if (p.conceptId.includes('.')) {
          conceptIdMap.set(p.conceptId.split('.').pop()!, p)
        }
      }
    }

    const findPayloadItem = (
      element: IElement
    ): ISetControlValueOption | undefined => {
      const cId = element.controlId
      if (cId && idMap.has(cId)) {
        const item = idMap.get(cId)!
        if (!item.groupId || item.groupId === element.control?.groupId) {
          return item
        }
      }
      const aId = element.areaId
      if (aId && areaIdMap.has(aId)) {
        const item = areaIdMap.get(aId)!
        if (!item.groupId || item.groupId === element.control?.groupId) {
          return item
        }
      }
      const conceptId = element.control?.conceptId
      if (conceptId) {
        const item =
          conceptIdMap.get(conceptId) ||
          conceptIdMap.get(conceptId.replace(/\./g, '_')) ||
          (conceptId.includes('.')
            ? conceptIdMap.get(conceptId.split('.').pop()!)
            : undefined)
        if (item && (!item.groupId || item.groupId === element.control?.groupId)) {
          return item
        }
      }
      return undefined
    }

    const processedControlIds = new Set<string>()
    const setValue = (elementList: IElement[]) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        // 表格下钻处理
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              setValue(td.value)
            }
          }
          i++
          continue
        }
        if (
          !element.control ||
          !element.controlId ||
          processedControlIds.has(element.controlId)
        ) {
          i++
          continue
        }

        const payloadItem = findPayloadItem(element)
        if (!payloadItem) {
          i++
          continue
        }
        processedControlIds.add(element.controlId)

        const value = payloadItem.value
        const isSubmitHistory = payloadItem.isSubmitHistory ?? true
        isExistSet = true
        if (isSubmitHistory) {
          isExistSubmitHistory = true
        }

        // 当前控件结束索引
        let currentEndIndex = i
        while (currentEndIndex < elementList.length) {
          const nextElement = elementList[currentEndIndex]
          if (nextElement.controlId !== element.controlId) break
          currentEndIndex++
        }
        // 模拟光标选区上下文（涵盖当前控件全范围）
        const fakeRange = {
          startIndex: i,
          endIndex: currentEndIndex - 1
        }
        const controlContext: IControlContext = {
          range: fakeRange,
          elementList
        }
        const controlRule: IControlRuleOption = {
          isIgnoreDisabledRule: true,
          isIgnoreDeletedRule: true
        }

        this.dispatchSetControlValue(
          element,
          value,
          controlContext,
          controlRule
        )

        // 控件操作后（增删元素后）动态重新定位当前控件范围与下一控件起始索引
        let nextI = i
        while (
          nextI < elementList.length &&
          elementList[nextI]?.controlId === element.controlId
        ) {
          nextI++
        }
        controlContext.range = {
          startIndex: i,
          endIndex: Math.max(i, nextI - 1)
        }

        // 控件值变更事件
        this.emitControlContentChange({
          context: controlContext
        })
        // 模拟控件激活后销毁
        this.activeControl = null
        i = nextI
      }
    }
    const data = [
      {
        zone: EditorZone.HEADER,
        elementList: this.draw.getHeaderElementList()
      },
      {
        zone: EditorZone.MAIN,
        elementList: this.draw.getOriginalMainElementList()
      },
      {
        zone: EditorZone.FOOTER,
        elementList: this.draw.getFooterElementList()
      }
    ]
    for (const { elementList } of data) {
      setValue(elementList)
    }
    if (isExistSet) {
      this.draw.render({
        isSetCursor: false,
        isSubmitHistory: isExistSubmitHistory
      })
    }
  }

  public cleanSelectionDelete(
    elementList: IElement[],
    startIndex: number,
    endIndex: number,
    options: IControlRuleOption = {}
  ): number {
    const isPreviewEdit = this.draw.getMode() === EditorMode.PREVIEW_EDIT

    // 1. 删除前扫描：收集触及的 controlId 及其初始结构与是否有值
    const isDeleteFromZero = startIndex === 0
    const startAt = isDeleteFromZero ? 1 : startIndex + 1
    const deleteCount = isDeleteFromZero ? endIndex : endIndex - startIndex
    const deleteEndAt = startAt + deleteCount - 1

    interface IControlPreInfo {
      hadValueBefore: boolean
      hasPrefixBefore: boolean
      hasPostfixBefore: boolean
      isPrefixSelected: boolean
      isPostfixSelected: boolean
      sampleElement: IElement | null
    }

    const controlPreInfoMap = new Map<string, IControlPreInfo>()

    for (let i = 0; i < elementList.length; i++) {
      const el = elementList[i]
      const cId = el?.controlId
      if (!cId) continue

      // 仅关注选区范围 [startIndex ... endIndex] 触及的控件
      const isTouched = i >= startIndex && i <= endIndex
      if (!controlPreInfoMap.has(cId)) {
        if (!isTouched) continue
        controlPreInfoMap.set(cId, {
          hadValueBefore: false,
          hasPrefixBefore: false,
          hasPostfixBefore: false,
          isPrefixSelected: false,
          isPostfixSelected: false,
          sampleElement: el
        })
      }

      const info = controlPreInfoMap.get(cId)!
      if (
        el.controlComponent === ControlComponent.VALUE ||
        el.controlComponent === ControlComponent.CHECKBOX ||
        el.controlComponent === ControlComponent.RADIO
      ) {
        if (el.value && el.value !== ZERO) {
          info.hadValueBefore = true
        } else if (
          el.type === ElementType.IMAGE ||
          el.controlComponent === ControlComponent.CHECKBOX ||
          el.controlComponent === ControlComponent.RADIO
        ) {
          info.hadValueBefore = true
        }
      }
      if (
        el.controlComponent === ControlComponent.PREFIX ||
        el.controlComponent === ControlComponent.PRE_TEXT
      ) {
        info.hasPrefixBefore = true
        if (i >= startAt && i <= deleteEndAt) {
          info.isPrefixSelected = true
        }
      }
      if (
        el.controlComponent === ControlComponent.POSTFIX ||
        el.controlComponent === ControlComponent.POST_TEXT
      ) {
        info.hasPostfixBefore = true
        if (i >= startAt && i <= deleteEndAt) {
          info.isPostfixSelected = true
        }
      }
    }

    // 2. 执行选区元素删除
    if (deleteCount > 0) {
      this.draw.deleteElementList(elementList, startAt, deleteCount, options)
    }

    if (isDeleteFromZero && elementList.length > 0) {
      elementList[0] = { value: ZERO }
    }

    let curResultIndex = startIndex

    // 3. 对受影响的控件进行闭环安全清理与前后缀自愈
    if (controlPreInfoMap.size > 0) {
      controlPreInfoMap.forEach((preInfo, controlId) => {
        const indices: number[] = []
        let hasValue = false
        let hasPrefix = false
        let hasPostfix = false
        let sampleElement = preInfo.sampleElement

        for (let i = 0; i < elementList.length; i++) {
          const el = elementList[i]
          if (el?.controlId === controlId) {
            indices.push(i)
            if (!sampleElement) sampleElement = el
            if (
              el.controlComponent === ControlComponent.VALUE ||
              el.controlComponent === ControlComponent.CHECKBOX ||
              el.controlComponent === ControlComponent.RADIO
            ) {
              if (el.value && el.value !== ZERO) {
                hasValue = true
              } else if (
                el.type === ElementType.IMAGE ||
                el.controlComponent === ControlComponent.CHECKBOX ||
                el.controlComponent === ControlComponent.RADIO
              ) {
                hasValue = true
              }
            }
            if (
              el.controlComponent === ControlComponent.PREFIX ||
              el.controlComponent === ControlComponent.PRE_TEXT
            ) {
              hasPrefix = true
            }
            if (
              el.controlComponent === ControlComponent.POSTFIX ||
              el.controlComponent === ControlComponent.POST_TEXT
            ) {
              hasPostfix = true
            }
          }
        }

        if (indices.length === 0) return

        if (!hasValue) {
          // 该控件已无任何实际内容
          // 判定是否应彻底整块移除：
          // 1) 无痕模式下必须彻底销毁
          // 2) 删除前本来就是无内容的空白占位符（用户选了空白占位符删除，意图即销毁该占位符）
          // 3) 选区破坏了前后缀闭环（!hasPrefix || !hasPostfix || preInfo.isPrefixSelected || preInfo.isPostfixSelected）
          const shouldDestroyWholeControl =
            isPreviewEdit ||
            !preInfo.hadValueBefore ||
            !hasPrefix ||
            !hasPostfix ||
            preInfo.isPrefixSelected ||
            preInfo.isPostfixSelected

          if (shouldDestroyWholeControl) {
            for (let k = indices.length - 1; k >= 0; k--) {
              const delIdx = indices[k]
              this.draw.deleteElementList(elementList, delIdx, 1, options)
              if (delIdx <= curResultIndex) {
                curResultIndex = Math.max(0, curResultIndex - 1)
              }
            }
          } else if (sampleElement?.control?.placeholder) {
            // 普通编辑态下：仅在原先有值、且用户仅清空文本未破坏前后缀时，恢复占位符
            const firstIdx = indices[0]
            if (hasPrefix && hasPostfix) {
              this.addPlaceholder(firstIdx, { elementList })
            }
          }
        } else {
          // 该控件仍有部分文字，自愈补齐缺失的前后缀，确保成对闭环
          const firstIdx = indices[0]
          const anchor = sampleElement || elementList[firstIdx]
          const anchorStyle = pickObject(anchor, [
            'control',
            'controlId',
            ...CONTROL_STYLE_ATTR
          ])

          if (!hasPrefix) {
            const prefixChar = anchor.control?.prefix || '{'
            const prefixNode: IElement = {
              ...anchorStyle,
              value: prefixChar,
              type: ElementType.CONTROL,
              controlComponent: ControlComponent.PREFIX,
              isPlaceholder: false
            }
            this.draw.spliceElementList(elementList, firstIdx, 0, [prefixNode])
            if (firstIdx <= curResultIndex) {
              curResultIndex++
            }
          }

          if (!hasPostfix) {
            let curLastIdx = -1
            for (let i = 0; i < elementList.length; i++) {
              if (elementList[i]?.controlId === controlId) {
                curLastIdx = i
              }
            }
            if (curLastIdx !== -1) {
              const postfixChar = anchor.control?.postfix || '}'
              const postfixNode: IElement = {
                ...anchorStyle,
                value: postfixChar,
                type: ElementType.CONTROL,
                controlComponent: ControlComponent.POSTFIX,
                isPlaceholder: false
              }
              this.draw.spliceElementList(elementList, curLastIdx + 1, 0, [
                postfixNode
              ])
            }
          }

          // 同步更新控件 control.value
          const remainValues: IElement[] = []
          for (let i = 0; i < elementList.length; i++) {
            const el = elementList[i]
            if (
              el?.controlId === controlId &&
              el.controlComponent === ControlComponent.VALUE
            ) {
              const copy = { ...el }
              delete copy.control
              delete copy.controlComponent
              delete copy.controlId
              remainValues.push(copy)
            }
          }
          for (let i = 0; i < elementList.length; i++) {
            const el = elementList[i]
            if (el?.controlId === controlId && el.control) {
              el.control.value = remainValues
              el.isPlaceholder = false
            }
          }
        }
      })
    }

    return curResultIndex
  }

  private dispatchSetControlValue(
    element: IElement,
    value: any,
    context: IControlContext,
    rule: IControlRuleOption
  ) {
    const rawType = (element.control?.type || '').toLowerCase()
    const listType = (element.control?.listType || '').toLowerCase()
    const isList = Boolean(listType)

    let effectiveType = rawType
    if (rawType === 'list' || !rawType) {
      if (listType === 'radio') effectiveType = ControlType.RADIO
      else if (listType === 'checkbox') effectiveType = ControlType.CHECKBOX
      else if (listType === 'image') effectiveType = ControlType.IMAGE
      else effectiveType = ControlType.TEXT
    }

    switch (effectiveType) {
      case ControlType.RADIO: {
        const radio = isList
          ? new ListRadioControl(element, this)
          : new RadioControl(element, this)
        this.activeControl = radio
        if (value !== null && value !== undefined) {
          radio.setSelect(value as any, context, rule)
        }
        break
      }
      case ControlType.CHECKBOX: {
        const checkbox = isList
          ? new ListCheckboxControl(element, this)
          : new CheckboxControl(element, this)
        this.activeControl = checkbox
        if (value !== null && value !== undefined) {
          checkbox.setSelect(value as any, context, rule)
        }
        break
      }
      case ControlType.IMAGE: {
        const image = isList
          ? new ListImageControl(element, this)
          : new ImageControl(element, this)
        this.activeControl = image
        if (value !== null && value !== undefined) {
          image.setValue(value as any, context, rule)
        }
        break
      }
      case ControlType.SELECT: {
        const select = new SelectControl(element, this)
        this.activeControl = select
        if (typeof value === 'string') {
          select.setSelect(value, context, rule)
        } else {
          select.clearSelect(context, rule)
        }
        break
      }
      case ControlType.DATE: {
        const date = new DateControl(element, this)
        this.activeControl = date
        if (Array.isArray(value)) {
          if (value.length) {
            formatElementList(value as IElement[], {
              isHandleFirstElement: false,
              editorOptions: this.options
            })
          }
          date.setValue(value as IElement[], context, rule)
        } else if (typeof value === 'string') {
          date.setSelect(value, context, rule)
        } else {
          date.clearSelect(context, rule)
        }
        break
      }
      case ControlType.NUMBER: {
        const formatValue = this.formatControlTextValue(value)
        const numberCtrl = new NumberControl(element, this)
        this.activeControl = numberCtrl
        if (formatValue.length) {
          numberCtrl.setValue(formatValue, context, rule)
        } else {
          numberCtrl.clearValue(context, rule)
        }
        break
      }
      case ControlType.TEXT:
      default: {
        const text = isList
          ? new ListTextControl(element, this)
          : new TextControl(element, this)
        this.activeControl = text
        if (value !== null && value !== undefined && value !== '') {
          if (isList) {
            text.setValue(value as any, context, rule)
          } else {
            const formatValue = this.formatControlTextValue(value)
            text.setValue(formatValue, context, rule)
          }
        } else {
          text.clearValue(context, rule)
        }
        break
      }
    }
  }

  private formatControlTextValue(value: any): IElement[] {
    let formatValue: IElement[] = []
    if (Array.isArray(value)) {
      // 检查数组元素是否已经是底层合法的 IElement 单字符节点
      const isElementList = value.every(
        item =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.value === 'string' &&
          !item.label &&
          !item.code &&
          !item.name
      )
      if (isElementList) {
        formatValue = value
      } else {
        // 容错处理：业务对象数组或字符串数组，提取文本并按换行拼接
        const textParts = value.map(item => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) {
            return String(
              item.label ?? item.text ?? item.value ?? item.content ?? item.name ?? ''
            )
          }
          return String(item ?? '')
        })
        const fullText = textParts.join('\n')
        formatValue = splitText(fullText).map(ch => ({
          value: ch === '\n' ? ZERO : ch
        }))
      }
    } else if (value !== null && value !== undefined && value !== '') {
      formatValue = splitText(String(value)).map(ch => ({
        value: ch === '\n' ? ZERO : ch
      }))
    }

    if (formatValue.length) {
      formatElementList(formatValue, {
        isHandleFirstElement: false,
        editorOptions: this.options
      })
    }
    return formatValue
  }

  public setExtensionListById(payload: ISetControlExtensionOption[]) {
    if (!payload.length) return
    const setExtension = (elementList: IElement[]) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        // 表格下钻处理
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              setExtension(td.value)
            }
          }
        }
        if (!element.control) continue
        // 获取设置值优先id、conceptId、areaId并于groupId组合设置
        const payloadItem = payload.find(
          p =>
            (!p.groupId || p.groupId === element.control?.groupId) &&
            ((p.id && element.controlId === p.id) ||
              (p.conceptId && element.control!.conceptId === p.conceptId) ||
              (p.areaId && element.areaId === p.areaId))
        )
        if (!payloadItem) continue
        const { extension } = payloadItem
        // 设置值
        this.setControlProperties(
          {
            extension
          },
          {
            elementList,
            range: { startIndex: i, endIndex: i }
          }
        )
        // 修改后控件结束索引
        let newEndIndex = i
        while (newEndIndex < elementList.length) {
          const nextElement = elementList[newEndIndex]
          if (nextElement.controlId !== element.controlId) break
          newEndIndex++
        }
        i = newEndIndex
      }
    }
    const data = [
      this.draw.getHeaderElementList(),
      this.draw.getOriginalMainElementList(),
      this.draw.getFooterElementList()
    ]
    for (const elementList of data) {
      setExtension(elementList)
    }
  }

  public setPropertiesListById(payload: ISetControlProperties[]) {
    if (!payload.length) return
    let isExistUpdate = false
    let isExistSubmitHistory = false
    const setProperties = (elementList: IElement[]) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              setProperties(td.value)
            }
          }
        }
        if (!element.control) continue
        // 获取设置值优先id、conceptId、areaId并于groupId组合设置
        const payloadItem = payload.find(
          p =>
            (!p.groupId || p.groupId === element.control?.groupId) &&
            ((p.id && element.controlId === p.id) ||
              (p.conceptId && element.control!.conceptId === p.conceptId) ||
              (p.areaId && element.areaId === p.areaId))
        )
        if (!payloadItem) continue
        const { properties, isSubmitHistory = true } = payloadItem
        isExistUpdate = true
        if (isSubmitHistory) {
          isExistSubmitHistory = true
        }
        // 设置属性
        this.setControlProperties(
          {
            ...element.control,
            ...properties,
            value: element.control.value
          },
          {
            elementList,
            range: { startIndex: i, endIndex: i }
          }
        )
        // 控件默认样式
        CONTROL_STYLE_ATTR.forEach(key => {
          const controlStyleProperty = properties[key]
          if (controlStyleProperty) {
            Reflect.set(element, key, controlStyleProperty)
          }
        })
        // 修改后控件结束索引
        let newEndIndex = i
        while (newEndIndex < elementList.length) {
          const nextElement = elementList[newEndIndex]
          if (nextElement.controlId !== element.controlId) break
          newEndIndex++
        }
        i = newEndIndex
      }
    }
    // 页眉页脚正文启动搜索
    const pageComponentData: IEditorData = {
      header: this.draw.getHeaderElementList(),
      main: this.draw.getOriginalMainElementList(),
      footer: this.draw.getFooterElementList()
    }
    for (const key in pageComponentData) {
      const elementList =
        pageComponentData[<keyof Omit<IEditorData, 'graffiti'>>key]!
      setProperties(elementList)
    }
    if (!isExistUpdate) return
    // 强制更新
    for (const key in pageComponentData) {
      const pageComponentKey = <keyof Omit<IEditorData, 'graffiti'>>key
      const elementList = zipElementList(pageComponentData[pageComponentKey]!, {
        isClassifyArea: true,
        extraPickAttrs: ['id']
      })
      pageComponentData[pageComponentKey] = elementList
      formatElementList(elementList, {
        editorOptions: this.options,
        isForceCompensation: true
      })
    }
    this.draw.setEditorData(pageComponentData)
    // 不保存历史时需清空之前记录，避免还原
    if (!isExistSubmitHistory) {
      this.draw.getHistoryManager().recovery()
    }
    this.draw.render({
      isSubmitHistory: isExistSubmitHistory,
      isSetCursor: false
    })
  }

  public getList(): IElement[] {
    const controlElementList: IElement[] = []
    function getControlElementList(elementList: IElement[]) {
      for (let e = 0; e < elementList.length; e++) {
        const element = elementList[e]
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              const tdElement = td.value
              getControlElementList(tdElement)
            }
          }
        }
        if (element.controlId && !isElementTraceDeleted(element)) {
          // 移除控件所在标题及列表上下文信息
          const controlElement = omitObject(element, [
            ...TITLE_CONTEXT_ATTR,
            ...LIST_CONTEXT_ATTR
          ])
          controlElementList.push(controlElement)
        }
      }
    }
    const data = [
      this.draw.getHeader().getElementList(),
      this.draw.getOriginalMainElementList(),
      this.draw.getFooter().getElementList()
    ]
    for (const elementList of data) {
      getControlElementList(elementList)
    }
    return zipElementList(controlElementList, {
      extraPickAttrs: ['controlId']
    })
  }

  public recordBorderInfo(x: number, y: number, width: number, height: number) {
    this.controlBorder.recordBorderInfo(x, y, width, height)
  }

  public drawBorder(ctx: CanvasRenderingContext2D) {
    this.controlBorder.render(ctx)
  }

  public getPreControlContext(): INextControlContext | null {
    if (!this.activeControl) return null
    const position = this.draw.getPosition()
    const positionContext = position.getPositionContext()
    if (!positionContext) return null
    const controlElement = this.activeControl.getElement()
    // 获取上一个控件上下文本信息
    function getPreContext(
      elementList: IElement[],
      start: number
    ): INextControlContext | null {
      for (let e = start; e > 0; e--) {
        const element = elementList[e]
        // 表格元素
        if (element.type === ElementType.TABLE) {
          const trList = element.trList || []
          for (let r = trList.length - 1; r >= 0; r--) {
            const tr = trList[r]
            const tdList = tr.tdList
            for (let d = tdList.length - 1; d >= 0; d--) {
              const td = tdList[d]
              const context = getPreContext(td.value, td.value.length - 1)
              if (context) {
                return {
                  positionContext: {
                    isTable: true,
                    index: e,
                    trIndex: r,
                    tdIndex: d,
                    tdId: td.id,
                    trId: tr.id,
                    tableId: element.id
                  },
                  nextIndex: context.nextIndex
                }
              }
            }
          }
        }
        if (
          !element.controlId ||
          element.controlId === controlElement.controlId
        ) {
          continue
        }
        // 找到尾部第一个非占位符元素
        let nextIndex = e
        while (nextIndex > 0) {
          const nextElement = elementList[nextIndex]
          if (
            nextElement.controlComponent === ControlComponent.VALUE ||
            nextElement.controlComponent === ControlComponent.PREFIX ||
            nextElement.controlComponent === ControlComponent.PRE_TEXT
          ) {
            break
          }
          nextIndex--
        }
        return {
          positionContext: {
            isTable: false
          },
          nextIndex
        }
      }
      return null
    }
    // 当前上下文控件信息
    const { startIndex } = this.range.getRange()
    const elementList = this.getElementList()
    const context = getPreContext(elementList, startIndex)
    if (context) {
      return {
        positionContext: positionContext.isTable
          ? positionContext
          : context.positionContext,
        nextIndex: context.nextIndex
      }
    }
    // 控件在单元内时继续循环
    if (controlElement.tableId) {
      const originalElementList = this.draw.getOriginalElementList()
      const { index, trIndex, tdIndex } = positionContext
      const trList = originalElementList[index!].trList!
      for (let r = trIndex!; r >= 0; r--) {
        const tr = trList[r]
        const tdList = tr.tdList
        for (let d = tdList.length - 1; d >= 0; d--) {
          if (trIndex === r && d >= tdIndex!) continue
          const td = tdList[d]
          const context = getPreContext(td.value, td.value.length - 1)
          if (context) {
            return {
              positionContext: {
                isTable: true,
                index: positionContext.index,
                trIndex: r,
                tdIndex: d,
                tdId: td.id,
                trId: tr.id,
                tableId: controlElement.tableId
              },
              nextIndex: context.nextIndex
            }
          }
        }
      }
      // 跳出表格继续循环
      const context = getPreContext(originalElementList, index! - 1)
      if (context) {
        return {
          positionContext: {
            isTable: false
          },
          nextIndex: context.nextIndex
        }
      }
    }
    return null
  }

  public getNextControlContext(): INextControlContext | null {
    if (!this.activeControl) return null
    const position = this.draw.getPosition()
    const positionContext = position.getPositionContext()
    if (!positionContext) return null
    const controlElement = this.activeControl.getElement()
    // 获取下一个控件上下文本信息
    function getNextContext(
      elementList: IElement[],
      start: number
    ): INextControlContext | null {
      for (let e = start; e < elementList.length; e++) {
        const element = elementList[e]
        // 表格元素
        if (element.type === ElementType.TABLE) {
          const trList = element.trList || []
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            const tdList = tr.tdList
            for (let d = 0; d < tdList.length; d++) {
              const td = tdList[d]
              const context = getNextContext(td.value!, 0)
              if (context) {
                return {
                  positionContext: {
                    isTable: true,
                    index: e,
                    trIndex: r,
                    tdIndex: d,
                    tdId: td.id,
                    trId: tr.id,
                    tableId: element.id
                  },
                  nextIndex: context.nextIndex
                }
              }
            }
          }
        }
        if (
          !element.controlId ||
          element.controlId === controlElement.controlId ||
          elementList[e + 1]?.controlComponent === ControlComponent.PREFIX ||
          elementList[e + 1]?.controlComponent === ControlComponent.PRE_TEXT
        ) {
          continue
        }
        return {
          positionContext: {
            isTable: false
          },
          nextIndex: e
        }
      }
      return null
    }
    // 当前上下文控件信息
    const { endIndex } = this.range.getRange()
    const elementList = this.getElementList()
    const context = getNextContext(elementList, endIndex)
    if (context) {
      return {
        positionContext: positionContext.isTable
          ? positionContext
          : context.positionContext,
        nextIndex: context.nextIndex
      }
    }
    // 控件在单元内时继续循环
    if (controlElement.tableId) {
      const originalElementList = this.draw.getOriginalElementList()
      const { index, trIndex, tdIndex } = positionContext
      const trList = originalElementList[index!].trList!
      for (let r = trIndex!; r < trList.length; r++) {
        const tr = trList[r]
        const tdList = tr.tdList
        for (let d = 0; d < tdList.length; d++) {
          if (trIndex === r && d <= tdIndex!) continue
          const td = tdList[d]
          const context = getNextContext(td.value, 0)
          if (context) {
            return {
              positionContext: {
                isTable: true,
                index: positionContext.index,
                trIndex: r,
                tdIndex: d,
                tdId: td.id,
                trId: tr.id,
                tableId: controlElement.tableId
              },
              nextIndex: context.nextIndex
            }
          }
        }
      }
      // 跳出表格继续循环
      const context = getNextContext(originalElementList, index! + 1)
      if (context) {
        return {
          positionContext: {
            isTable: false
          },
          nextIndex: context.nextIndex
        }
      }
    }
    return null
  }

  public initNextControl(option: IInitNextControlOption = {}) {
    const { direction = MoveDirection.DOWN } = option
    let context: INextControlContext | null = null
    if (direction === MoveDirection.UP) {
      context = this.getPreControlContext()
    } else {
      context = this.getNextControlContext()
    }
    if (!context) return
    const { nextIndex, positionContext } = context
    const position = this.draw.getPosition()
    // 设置上下文
    position.setPositionContext(positionContext)
    this.draw.getRange().replaceRange({
      startIndex: nextIndex,
      endIndex: nextIndex
    })
    // 重新渲染并定位
    this.draw.render({
      curIndex: nextIndex,
      isCompute: false,
      isSetCursor: true,
      isSubmitHistory: false
    })
  }

  public setMinWidthControlInfo(option: ISetControlRowFlexOption) {
    const { row, rowElement, controlRealWidth, availableWidth } = option
    if (!rowElement.control?.minWidth) return
    const { scale } = this.options
    const controlMinWidth = rowElement.control.minWidth * scale
    // 设置首字符偏移量：如果控件内设置对齐方式&&存在设置最小宽度
    let controlFirstElement: IRowElement | null = null
    if (
      rowElement.control?.minWidth &&
      (rowElement.control?.rowFlex === RowFlex.CENTER ||
        rowElement.control?.rowFlex === RowFlex.RIGHT)
    ) {
      // 计算当前控件内容宽度是否超出最小宽度设置
      let controlContentWidth = rowElement.metrics.width
      let controlElementIndex = row.elementList.length - 1
      while (controlElementIndex >= 0) {
        const controlRowElement = row.elementList[controlElementIndex]
        controlContentWidth += controlRowElement.metrics.width
        // 找到首字符结束循环
        if (
          row.elementList[controlElementIndex - 1]?.controlComponent ===
          ControlComponent.PREFIX
        ) {
          controlFirstElement = controlRowElement
          break
        }
        controlElementIndex--
      }
      // 计算首字符偏移量
      if (controlFirstElement) {
        if (controlContentWidth < controlMinWidth) {
          if (rowElement.control.rowFlex === RowFlex.CENTER) {
            controlFirstElement.left =
              (controlMinWidth - controlContentWidth) / 2
          } else if (rowElement.control.rowFlex === RowFlex.RIGHT) {
            // 最小宽度 - 实际宽度 - 后缀元素宽度
            controlFirstElement.left =
              controlMinWidth - controlContentWidth - rowElement.metrics.width
          }
        }
      }
    }
    // 设置后缀偏移量：消费小于实际最小宽度
    const extraWidth = controlMinWidth - controlRealWidth
    if (extraWidth > 0) {
      const controlFirstElementLeft = controlFirstElement?.left || 0
      // 超出行宽时截断
      const rowRemainingWidth =
        availableWidth - row.width - rowElement.metrics.width
      const left = Math.min(rowRemainingWidth, extraWidth)
      // 后缀偏移量需减去首字符的偏移量，避免重复偏移
      rowElement.left = left - controlFirstElementLeft
      row.width += left - controlFirstElementLeft
    }
  }
}
