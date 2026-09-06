import { describe, it, expect, afterEach } from 'vitest'
import { createTestEditor } from '../../factories/editor'

describe('搜索替换命令', () => {
  let ctx: ReturnType<typeof createTestEditor>
  afterEach(() => ctx?.destroy())

  it('executeSearch 不抛错', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello world' }])
    expect(() => {
      ctx.editor.command.executeSearch('world')
    }).not.toThrow()
  })

  it('正则搜索导航按实际匹配长度计算', () => {
    ctx = createTestEditor({
      data: {
        header: [],
        main: [{ value: 'hi hello hey' }, { value: '\n' }],
        footer: []
      }
    })

    ctx.editor.command.executeSearch('h\\w+', { isRegEnable: true })
    ctx.editor.command.executeSearchNavigateNext()

    expect(ctx.editor.command.getSearchNavigateInfo()).toEqual({
      index: 1,
      count: 3
    })

    ctx.editor.command.executeSearchNavigatePre()

    expect(ctx.editor.command.getSearchNavigateInfo()).toEqual({
      index: 3,
      count: 3
    })
  })

  it('executeReplace 不抛错', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    ctx.editor.command.executeInsertElementList([{ value: 'hello world' }])
    expect(() => {
      ctx.editor.command.executeReplace('planet')
    }).not.toThrow()
  })

  it('留痕开启时替换为空字符串不产生非法光标', () => {
    ctx = createTestEditor({
      data: {
        header: [],
        main: [{ value: 'hello' }, { value: '\n' }],
        footer: []
      },
      options: { trace: { disabled: false } }
    })

    ctx.editor.command.executeSearch('hello')

    expect(() => {
      ctx.editor.command.executeReplace('')
    }).not.toThrow()
    const range = ctx.editor.command.getRange()
    expect(range.startIndex).toBeGreaterThanOrEqual(0)
    expect(range.endIndex).toBeGreaterThanOrEqual(0)
  })

  it('包含表格以及表格后面的正文内容均可正确搜索匹配', () => {
    ctx = createTestEditor({
      data: {
        header: [],
        main: [
          { value: '前置文本\n' },
          {
            type: 'table' as any,
            value: '',
            trList: [
              {
                height: 40,
                tdList: [
                  {
                    colspan: 1,
                    rowspan: 1,
                    value: [{ value: '单元格内容' }]
                  }
                ]
              }
            ]
          },
          { value: '后置文本标记' }
        ],
        footer: []
      }
    })

    // 搜索表格前面的内容
    ctx.editor.command.executeSearch('前置文本')
    expect(ctx.editor.command.getSearchNavigateInfo()?.count).toBe(1)

    // 搜索表格内部的内容
    ctx.editor.command.executeSearch('单元格内容')
    expect(ctx.editor.command.getSearchNavigateInfo()?.count).toBe(1)

    // 搜索表格后面的内容（验证修复了表格后内容被截断丢弃的严重缺陷）
    ctx.editor.command.executeSearch('后置文本标记')
    expect(ctx.editor.command.getSearchNavigateInfo()?.count).toBe(1)
  })
})
