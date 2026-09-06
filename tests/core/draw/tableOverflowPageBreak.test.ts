import { describe, it, expect } from 'vitest'
import { Draw } from '@/editor/core/draw/Draw'
import { EventBus } from '@/editor/core/event/eventbus/EventBus'
import { Listener } from '@/editor/core/listener/Listener'
import { Override } from '@/editor/core/override/Override'
import { mergeOption } from '@/editor/utils/option'
import { formatElementList } from '@/editor/utils/element'
import { EditorMode } from '@/editor/dataset/enum/Editor'
import { IElement } from '@/editor/interface/Element'

const PAGE_OPTION = {
  width: 794,
  height: 1123,
  margins: [100, 120, 100, 120] as [number, number, number, number],
  header: { disabled: true },
  footer: { disabled: false }
}

describe('表格文字过多时导致次页空白复现与修复测试', () => {
  it('测试表格溢出导致的次页空白', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const options = mergeOption(PAGE_OPTION)
    const fs = await import('fs')
    const path = await import('path')
    const htmlPath = path.resolve(process.cwd(), 'demo/test.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')
    const marker = 'getTemplate: async () => {\n        return '
    const start = html.indexOf(marker)
    const jsonStart = start + marker.length
    let depth = 0
    let end = jsonStart
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === '{') depth++
      else if (html[i] === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    const tpl = JSON.parse(html.slice(jsonStart, end))
    const mainElements: IElement[] = tpl.data.main.slice(0, 15)

    // 精确模拟用户截图场景：
    // 第一个表格追加行并填入大量文字，使得表格在第 1 页底部刚好占满页面可用高度（883px左右），
    // 导致表格后面的换行符和 pageBreak 溢出到第 2 页！
    const table1 = mainElements[5]
    table1.trList!.push({
      height: 46,
      minHeight: 46,
      tdList: [
        {
          colspan: 1,
          rowspan: 1,
          width: 149,
          value: [{ value: '评估单位：', bold: true, size: 18, font: '华文仿宋' }]
        },
        {
          colspan: 1,
          rowspan: 1,
          width: 405,
          value: [{ value: '湖南兽变很大塑封我合法第三方束带结发考虑', bold: true, size: 18, font: '华文仿宋' }]
        }
      ]
    })
    table1.trList!.push({
      height: 200,
      minHeight: 46,
      tdList: [
        {
          colspan: 1,
          rowspan: 1,
          width: 149,
          value: [{ value: '评估单位：', bold: true, size: 18, font: '华文仿宋' }]
        },
        {
          colspan: 1,
          rowspan: 1,
          width: 405,
          value: [{ value: '发生的方式放大数据库附件理发师螺恋蜂狂久啊三等奖付了款岁数大了开发阿斯蒂就流水受打击了开发商打发时间到啦开发三等奖福利卡阿萨法久啊圣诞快乐附件阿萨德荆防颗粒啊所发生的李逵负荆啊酸辣粉', bold: true, size: 18, font: '华文仿宋' }]
        }
      ]
    })

    // 调大前面空行或者直接增加空行，使表格底部刚好把后面的换行与 pageBreak 挤到下一页
    mainElements.splice(4, 0,
      { value: '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n' }
    )

    formatElementList(mainElements, { editorOptions: options, isForceCompensation: true })

    const draw = new Draw(
      container,
      options,
      { header: [{ value: '\n' }], main: mainElements, footer: [{ value: '\n' }] },
      new Listener(),
      new EventBus(),
      new Override()
    )
    draw.setMode(EditorMode.EDIT)
    draw.render()

    const lastTd = table1.trList![4].tdList[1]
    console.log('lastTd mainHeight:', lastTd.mainHeight, 'rowList len:', lastTd.rowList?.length, 'value len:', lastTd.value?.length)
    console.log('row 0 width:', lastTd.rowList?.[0]?.width, 'row 0 el count:', lastTd.rowList?.[0]?.elementList?.length)
    const pageRowList = draw.getPageRowList()
    table1.trList!.forEach((tr, i) => console.log(`  tr ${i}: height=${tr.height}`))
    console.log('table1 element height:', table1.height)
    console.log('Total pages with real template:', pageRowList.length)
    pageRowList.forEach((page, pIdx) => {
      console.log(`\n--- Page ${pIdx} (total rows: ${page.length}) ---`)
      page.forEach((r, rIdx) => {
        const text = r.elementList.map(e => e.value).join('').replace(/\n/g, '\\n')
        const type = r.elementList.map(e => e.type || 'text').join(',')
        console.log(`  [Row ${rIdx}] height=${r.height.toFixed(1)}, isPageBreak=${!!r.isPageBreak}, tableFrag=${!!r.tableFragment}, text="${text.slice(0, 30)}", types="${type}"`)
      })
    })

    // 检查第 2 页（索引 1）：它是否是纯空白页（没有实质内容，只有空行或 pageBreak）
    const page1 = pageRowList[1]
    if (page1) {
      const isPage1Empty = page1.every(r => {
        if (r.isPageBreak) return true
        return r.elementList.every(el => !el.value || el.value === '\n' || el.value === '\r' || el.value === '​' || el.value.trim() === '')
      })
      console.log('Is Page 1 completely empty?', isPage1Empty)
      expect(isPage1Empty).toBe(false)
    }
  })
})
