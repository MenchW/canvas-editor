import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../factories/editor'

function makeTableRows(count: number, cols: number): string {
  let html = '<table><colgroup>'
  for (let c = 0; c < cols; c++) {
    html += '<col style="width: 100pt">'
  }
  html += '</colgroup>'
  for (let r = 0; r < count; r++) {
    html += '<tr>'
    for (let c = 0; c < cols; c++) {
      html += `<td style="border: 0.5pt solid rgb(0,0,0)">行${r}列${c}</td>`
    }
    html += '</tr>'
  }
  return html + '</table>'
}

describe('Word 导入跨页表格渲染', () => {
  it('大表格跨页渲染不崩溃', () => {
    const { editor, destroy } = createTestEditor()
    const html = makeTableRows(40, 3)
    expect(() => editor.command.executeSetHTML({ main: html })).not.toThrow()
    destroy()
  })

  it('超高单元格跨页渲染不崩溃', () => {
    const { editor, destroy } = createTestEditor()
    const html = `
<table><colgroup><col style="width: 200pt"></colgroup>
<tr><td style="border: 0.5pt solid rgb(0,0,0)">${'超长内容'.repeat(200)}</td></tr>
</table>`
    expect(() => editor.command.executeSetHTML({ main: html })).not.toThrow()
    destroy()
  })

  it('跨页合并单元格表格不崩溃', () => {
    const { editor, destroy } = createTestEditor()
    let html = '<table><colgroup><col style="width: 100pt"><col style="width: 100pt"></colgroup>'
    html += '<tr><td rowspan="3" style="border: 0.5pt solid rgb(0,0,0)">跨三行</td><td style="border: 0.5pt solid rgb(0,0,0)">a</td></tr>'
    for (let r = 1; r < 40; r++) {
      html += `<tr><td style="border: 0.5pt solid rgb(0,0,0)">行${r}</td></tr>`
    }
    html += '</table>'
    expect(() => editor.command.executeSetHTML({ main: html })).not.toThrow()
    destroy()
  })
})
