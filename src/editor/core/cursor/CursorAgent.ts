import { EDITOR_PREFIX } from '../../dataset/constant/Editor'
import { KeyMap } from '../../dataset/enum/KeyMap'
import { EventBusMap } from '../../interface/EventBus'
import { Draw } from '../draw/Draw'
import { CanvasEvent } from '../event/CanvasEvent'
import { EventBus } from '../event/eventbus/EventBus'
import { pasteByEvent } from '../event/handlers/paste'

export class CursorAgent {
  private draw: Draw
  private container: HTMLDivElement
  private agentCursorDom: HTMLTextAreaElement
  private canvasEvent: CanvasEvent
  private eventBus: EventBus<EventBusMap>

  constructor(draw: Draw, canvasEvent: CanvasEvent) {
    this.draw = draw
    this.container = draw.getContainer()
    this.canvasEvent = canvasEvent
    this.eventBus = draw.getEventBus()
    // 代理光标绘制
    const agentCursorDom = document.createElement('textarea')
    agentCursorDom.autocomplete = 'off'
    agentCursorDom.classList.add(`${EDITOR_PREFIX}-inputarea`)
    agentCursorDom.innerText = ''
    this.container.append(agentCursorDom)
    this.agentCursorDom = agentCursorDom
    // 事件
    agentCursorDom.onkeydown = (evt: KeyboardEvent) => this._keyDown(evt)
    agentCursorDom.oninput = this._input.bind(this)
    agentCursorDom.onpaste = (evt: ClipboardEvent) => this._paste(evt)
    agentCursorDom.addEventListener(
      'compositionstart',
      this._compositionstart.bind(this)
    )
    agentCursorDom.addEventListener(
      'compositionend',
      this._compositionend.bind(this)
    )
  }

  public getAgentCursorDom(): HTMLTextAreaElement {
    return this.agentCursorDom
  }

  private _keyDown(evt: KeyboardEvent) {
    const isComposing =
      this.canvasEvent.isComposing || evt.isComposing || evt.keyCode === 229
    // 仅在正在输入拼音，或极短时间（<40ms）内伴随输入法回车直接确认上屏的残余事件时拦截 Enter
    const isCompositionLeak =
      Boolean(this.canvasEvent.lastCompositionTime) &&
      performance.now() - this.canvasEvent.lastCompositionTime < 40
    if (isComposing || isCompositionLeak) {
      if (
        evt.key === KeyMap.Enter ||
        evt.key === 'Process' ||
        evt.keyCode === 229 ||
        evt.keyCode === 13
      ) {
        this.canvasEvent.hasJustComposed = false
        this.canvasEvent.lastCompositionTime = 0
        evt.preventDefault?.()
        return
      }
    }
    this.canvasEvent.hasJustComposed = false
    this.canvasEvent.keydown(evt)
  }

  private _input(evt: Event) {
    const inputEvt = <InputEvent>evt
    // 忽略原生 textarea 产生的换行事件，换行完全由编辑器键盘管理器处理
    if (inputEvt.inputType === 'insertLineBreak') {
      return
    }
    const data = inputEvt.data
    if (!data || data === '\n' || data === '\r\n') {
      return
    }
    const isComposing = this.canvasEvent.isComposing || inputEvt.isComposing
    const positionContext = this.draw.getPosition().getPositionContext()
    const isTable = !!positionContext.isTable
    const control = this.draw.getControl()
    const isWithinControl = control.getIsRangeWithinControl()

    // 1. 如果处于拼音合成态（打拼音中），且当前处于表格单元格内或控件内：
    // 阻断中间拼音字母直接写入文档数据，防止拼音穿透并破坏表格或控件结构
    if (isComposing && (isTable || isWithinControl)) {
      return
    }

    // 2. 选词完成后紧随（80ms内）的 input 事件去重，防止同一个中文词汇重复上屏
    const isRecentComposed =
      Boolean(this.canvasEvent.lastCompositionTime) &&
      performance.now() - this.canvasEvent.lastCompositionTime < 80
    if (
      isRecentComposed &&
      (data === this.canvasEvent.lastCompositionData ||
        inputEvt.inputType === 'insertCompositionText' ||
        inputEvt.inputType === 'insertText')
    ) {
      this.canvasEvent.hasJustComposed = false
      return
    }

    this.canvasEvent.input(data)
    if (this.eventBus.isSubscribe('input')) {
      this.eventBus.emit('input', evt)
    }
  }

  private _paste(evt: ClipboardEvent) {
    const isReadonly = this.draw.isReadonly()
    if (isReadonly) return
    const clipboardData = evt.clipboardData
    if (!clipboardData) return
    pasteByEvent(this.canvasEvent, evt)
    evt.preventDefault()
  }

  private _compositionstart() {
    this.canvasEvent.compositionstart()
  }

  private _compositionend(evt: CompositionEvent) {
    this.canvasEvent.compositionend(evt)
  }
}
