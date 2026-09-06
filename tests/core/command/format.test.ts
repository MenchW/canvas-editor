import { describe, it, expect, afterEach } from 'vitest'
import { createTestEditor } from '../../factories/editor'

describe('格式化命令', () => {
  let ctx: ReturnType<typeof createTestEditor>
  afterEach(() => ctx?.destroy())

  it('executeFormat 清除样式', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello', bold: true, italic: true }])
    ctx.editor.command.executeSelectAll()
    ctx.editor.command.executeFormat()
    const data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.bold || e.italic)).toBe(false)
  })

  it('executeFont 改变字体', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello' }])
    ctx.editor.command.executeSelectAll()
    ctx.editor.command.executeFont('Arial')
    const data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.font === 'Arial')).toBe(true)
  })

  it('executeSize 改变字号', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello' }])
    ctx.editor.command.executeSelectAll()
    ctx.editor.command.executeSize(20)
    const data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.size === 20)).toBe(true)
  })

  it('executeColor 改变颜色', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello' }])
    ctx.editor.command.executeSelectAll()
    ctx.editor.command.executeColor('#ff0000')
    const data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.color === '#ff0000')).toBe(true)
  })

  it('executeHighlight 改变高亮', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello' }])
    ctx.editor.command.executeSelectAll()
    ctx.editor.command.executeHighlight('#ffff00')
    const data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.highlight === '#ffff00')).toBe(true)
  })

  it('executeColor 支持 isSubmitHistoryDebounce 防抖记录历史，避免调色卡顿且不丢失历史记录', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello' }])
    ctx.editor.command.executeSelectAll()

    const historyManager = (ctx.editor.command.getDraw() as any).getHistoryManager()
    const undoStackBefore = historyManager.undoStack.length

    // 模拟调色板拖拽：高频触发颜色变更，开启防抖
    ctx.editor.command.executeColor('#111111', {
      isSubmitHistory: true,
      isSubmitHistoryDebounce: true
    })
    ctx.editor.command.executeColor('#222222', {
      isSubmitHistory: true,
      isSubmitHistoryDebounce: true
    })
    ctx.editor.command.executeColor('#333333', {
      isSubmitHistory: true,
      isSubmitHistoryDebounce: true
    })

    // 画布内容颜色已被实时应用为最新值
    let data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.color === '#333333')).toBe(true)

    // 在防抖窗口内，未触发多次 AST 快照深拷贝，undoStack 长度保持不变
    expect(historyManager.undoStack.length).toBe(undoStackBefore)

    // 用户在没有等待 300ms 超时的情况下直接点击撤销，内部 flushHistory 立即收敛入栈并一步还原
    ctx.editor.command.executeUndo()
    data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.color === '#333333')).toBe(false)
  })

  it('executeHighlight 支持 isSubmitHistoryDebounce 防抖记录历史', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'world' }])
    ctx.editor.command.executeSelectAll()

    const historyManager = (ctx.editor.command.getDraw() as any).getHistoryManager()
    const undoStackBefore = historyManager.undoStack.length

    // 模拟高亮调色过程防抖
    ctx.editor.command.executeHighlight('#ff0000', {
      isSubmitHistory: true,
      isSubmitHistoryDebounce: true
    })
    ctx.editor.command.executeHighlight('#00ff00', {
      isSubmitHistory: true,
      isSubmitHistoryDebounce: true
    })

    let data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.highlight === '#00ff00')).toBe(true)
    expect(historyManager.undoStack.length).toBe(undoStackBefore)

    // 直接撤销，先落盘挂起状态再还原回变色前的文本高亮
    ctx.editor.command.executeUndo()
    data = ctx.editor.command.getValue().data.main
    expect(data?.some((e: any) => e.highlight === '#00ff00')).toBe(false)
  })
})
