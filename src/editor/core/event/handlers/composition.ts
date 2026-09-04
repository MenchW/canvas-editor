import { isFirefox } from '../../../utils/ua'
import { CanvasEvent } from '../CanvasEvent'
import { input, removeComposingInput } from './input'

function compositionstart(host: CanvasEvent) {
  console.log(
    '%c[IME-Lifecycle]%c compositionstart (开始拼音输入)',
    'color: #ff9800; font-weight: bold',
    'color: inherit'
  )
  // 在开始拼音输入前，立即将前一个操作的历史快照落定，并清除防抖定时器，防止拼音过程字母被存入快照
  host.getDraw().flushHistory()
  host.isComposing = true
}

function compositionend(host: CanvasEvent, evt: CompositionEvent) {
  const tStart = performance.now()
  console.log(
    `%c[IME-Lifecycle]%c compositionend (拼音转中文上屏) data="${evt.data}"`,
    'color: #4caf50; font-weight: bold',
    'color: inherit'
  )
  host.isComposing = false
  // 处理输入框关闭
  const draw = host.getDraw()
  // 不存在值：删除合成输入
  if (!evt.data) {
    removeComposingInput(host)
    const rangeManager = draw.getRange()
    const { endIndex: curIndex } = rangeManager.getRange()
    draw.render({
      curIndex,
      isSubmitHistory: false
    })
  } else {
    // 存在值：无法触发input事件需手动检测并触发渲染
    if (isFirefox) {
      // 如果为0，火狐浏览器会在input事件之前执行导致重复输入
      setTimeout(() => {
        if (host.compositionInfo) {
          input(evt.data, host)
        }
      }, 1)
    } else {
      if (host.compositionInfo) {
        input(evt.data, host)
      }
    }
  }
  // 移除代理输入框数据
  const cursor = draw.getCursor()
  cursor.clearAgentDomValue()
  console.log(
    `[IME-Lifecycle] compositionend 完成，耗时: ${(performance.now() - tStart).toFixed(1)}ms`
  )
}

export default {
  compositionstart,
  compositionend
}
