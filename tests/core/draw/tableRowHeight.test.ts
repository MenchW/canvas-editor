import { describe, it, expect } from 'vitest'
import { Draw } from '@/editor/core/draw/Draw'
import { EventBus } from '@/editor/core/event/eventbus/EventBus'
import { Listener } from '@/editor/core/listener/Listener'
import { Override } from '@/editor/core/override/Override'
import { mergeOption } from '@/editor/utils/option'
import { formatElementList } from '@/editor/utils/element'
import { ElementType } from '@/editor/dataset/enum/Element'
import { IElement } from '@/editor/interface/Element'

const PAGE_OPTION = {
  width: 794,
  height: 1123,
  margins: [100, 120, 100, 120] as [number, number, number, number],
  header: { disabled: true },
  footer: { disabled: true }
}

function renderMain(
  main: IElement[],
  optionOverrides: Record<string, unknown> = {}
): Draw {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const options = mergeOption({ ...PAGE_OPTION, ...optionOverrides })
  formatElementList(main, {
    editorOptions: options,
    isForceCompensation: true
  })
  const draw = new Draw(
    container,
    options,
    { header: [{ value: '\n' }], main, footer: [{ value: '\n' }] },
    new Listener(),
    new EventBus(),
    new Override()
  )
  draw.render()
  return draw
}

describe('表格单元格高度自适应', () => {
  it('跨行合并单元格内容过多时跨及行随内容撑高', () => {
    // 第 1 行第 2 列向下合并 2 行且内容超高：增长量加在合并范围最后一行，
    // 缩减时不应因合并单元格不在该行分组内而把高度再缩回去
    const longText = Array.from({ length: 6 }, (_, i) => `内容${i + 1}`).join(
      '\n'
    )
    const table = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 277 }, { width: 277 }],
      trList: [
        {
          height: 42,
          minHeight: 42,
          tdList: [
            { colspan: 1, rowspan: 1, value: [] },
            { colspan: 1, rowspan: 2, value: [{ value: longText, size: 16 }] }
          ]
        },
        {
          height: 42,
          minHeight: 42,
          tdList: [{ colspan: 1, rowspan: 1, value: [] }]
        },
        {
          height: 42,
          minHeight: 42,
          tdList: [
            { colspan: 1, rowspan: 1, value: [] },
            { colspan: 1, rowspan: 1, value: [] }
          ]
        }
      ]
    } as unknown as IElement
    const draw = renderMain([table])
    const tableElement = draw
      .getOriginalElementList()
      .find(element => element.type === ElementType.TABLE)!
    const spanTd = tableElement.trList![0].tdList[1]
    const contentHeight = spanTd.mainHeight!
    // 内容高度超过合并范围初始行高（2*42）
    expect(contentHeight).toBeGreaterThan(84)
    // 合并范围最后一行被撑高（增长量加在该行且不被缩减）
    expect(tableElement.trList![1].height!).toBeGreaterThan(42)
    // 合并单元格高度覆盖内容高度
    expect(spanTd.height!).toBeGreaterThanOrEqual(contentHeight)
  })

  it('单行中一列为超长多行文字时，整行持续撑高，且单元格高度严格大于等于内容高度，杜绝文字溢出', () => {
    const longText = Array.from(
      { length: 6 },
      (_, i) => `染；冷冻食材标注存放日期，定期清理过期食材${i + 1}`
    ).join('\n')
    const table = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 100 }, { width: 150 }, { width: 100 }],
      trList: [
        {
          height: 36,
          minHeight: 36,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: '学生食用' }] },
            { colspan: 1, rowspan: 1, value: [{ value: longText, size: 14 }] },
            { colspan: 1, rowspan: 1, value: [{ value: '多图' }] }
          ]
        },
        {
          height: 36,
          minHeight: 36,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: '第二行' }] },
            { colspan: 1, rowspan: 1, value: [{ value: '设置符合操作规范' }] },
            { colspan: 1, rowspan: 1, value: [{ value: '图2' }] }
          ]
        }
      ]
    } as unknown as IElement

    const draw = renderMain([table])
    const tableElement = draw
      .getOriginalElementList()
      .find(element => element.type === ElementType.TABLE)!
    const longTd = tableElement.trList![0].tdList[1]
    const contentHeight = longTd.mainHeight!

    // 内容高度远超 36px 初始行高
    expect(contentHeight).toBeGreaterThan(100)
    // 所在行高度被持续撑高覆盖内容高度
    expect(tableElement.trList![0].height!).toBeGreaterThanOrEqual(contentHeight)
    expect(longTd.height!).toBeGreaterThanOrEqual(contentHeight)
  })

  it('精确复现 test.html 第 3 条数据在 PREVIEW_EDIT 模式下的行高与坐标', () => {
    const textValue =
      '每日进行环境清洁消毒，保持良好通风；\n地面保持防滑、无破损，每日清洁并定期消毒；\n墙面在操作高度范围内需光滑防水，无霉斑、油污，每周全面清洁；\n垃圾桶加盖，定时倾倒垃圾防止溢出；\n整体环境（花台、绿化带、喷水池等）保持清洁。'
    const tdValue = [
      {
        value: '{',
        controlComponent: 'prefix',
        isPlaceholder: false
      },
      ...textValue.split('').map(char => ({
        value: char,
        controlComponent: 'value',
        size: 14,
        rowMargin: 1.5
      })),
      {
        value: '}',
        controlComponent: 'postfix',
        isPlaceholder: false
      }
    ]

    const table = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 63 }, { width: 179 }, { width: 172 }, { width: 138 }],
      trList: [
        {
          height: 42,
          minHeight: 42,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: '3' }] },
            { colspan: 1, rowspan: 1, value: [{ value: '地面脏乱差，卫生条件极差' }] },
            { colspan: 1, rowspan: 1, value: tdValue },
            { colspan: 1, rowspan: 1, value: [{ value: '多图' }] }
          ]
        }
      ]
    } as unknown as IElement

    const drawEdit = renderMain([table], { mode: 'edit' })
    const drawPreview = renderMain([table], { mode: 'preview_edit' })

    const tableEdit = drawEdit.getOriginalElementList().find(e => e.type === ElementType.TABLE)!
    const tablePreview = drawPreview.getOriginalElementList().find(e => e.type === ElementType.TABLE)!

    const tdEdit = tableEdit.trList![0].tdList[2]
    const tdPreview = tablePreview.trList![0].tdList[2]

    console.log('--- EDIT ---')
    console.log('tr.height:', tableEdit.trList![0].height, 'td.height:', tdEdit.height, 'mainHeight:', tdEdit.mainHeight)
    console.log('rowList count:', tdEdit.rowList?.length, 'totalRowHeight:', tdEdit.rowList?.reduce((p, c) => p + c.height, 0))

    console.log('--- PREVIEW_EDIT ---')
    console.log('tr.height:', tablePreview.trList![0].height, 'td.height:', tdPreview.height, 'mainHeight:', tdPreview.mainHeight)
    console.log('rowList count:', tdPreview.rowList?.length, 'totalRowHeight:', tdPreview.rowList?.reduce((p, c) => p + c.height, 0))

    // 检查 tdPreview.positionList 中最后一个可见字符的位置
    const posList = tdPreview.positionList || []
    const lastVisiblePos = posList[posList.length - 2] || posList[posList.length - 1]
    console.log('lastVisiblePos:', lastVisiblePos?.value, 'coordinate:', lastVisiblePos?.coordinate)
  })
})
