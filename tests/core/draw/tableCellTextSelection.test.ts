import { describe, it, expect } from 'vitest'
import { Draw } from '@/editor/core/draw/Draw'
import { EventBus } from '@/editor/core/event/eventbus/EventBus'
import { Listener } from '@/editor/core/listener/Listener'
import { Override } from '@/editor/core/override/Override'
import { mergeOption } from '@/editor/utils/option'
import { formatElementList } from '@/editor/utils/element'
import { ElementType } from '@/editor/dataset/enum/Element'
import { EditorMode } from '@/editor/dataset/enum/Editor'
import { IElement } from '@/editor/interface/Element'
import { cloneTrTemplate } from '@/editor/utils/dataEngine'

const PAGE_OPTION = {
  width: 794,
  height: 1123,
  margins: [100, 120, 100, 120] as [number, number, number, number],
  header: { disabled: true },
  footer: { disabled: true }
}

describe('Table Cell Text Selection', () => {
  it('cloned template row elements should have tdId, trId, and tableId synchronized', () => {
    const templateTr = {
      height: 100,
      tdList: [
        {
          id: 'old-td-id',
          value: [
            {
              value: '',
              type: ElementType.CONTROL,
              control: {
                type: 'text',
                conceptId: 'evalContent',
                placeholder: 'evalContent'
              }
            }
          ]
        }
      ]
    }

    const cloned = cloneTrTemplate(templateTr)
    expect(cloned.id).toBeTruthy()
    expect(cloned.id).not.toBe('old-td-id')
    expect(cloned.tdList[0].id).toBeTruthy()
    expect(cloned.tdList[0].id).not.toBe('old-td-id')
    expect(cloned.tdList[0].value[0].tdId).toBe(cloned.tdList[0].id)
    expect(cloned.tdList[0].value[0].trId).toBe(cloned.id)
  })

  it('table cell elements should properly render text range selection inside cell', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const options = mergeOption(PAGE_OPTION)

    const tableElement: IElement = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 200 }, { width: 300 }],
      trList: [
        {
          height: 100,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: '序号' }] },
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  value: '',
                  type: ElementType.CONTROL,
                  control: {
                    type: 'text' as any,
                    value: [{ value: '食堂持有效食品经营许可证' }]
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    const main = [tableElement]
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
    draw.setMode(EditorMode.PREVIEW_EDIT)
    draw.render({ isSubmitHistory: false })

    const targetTable = draw
      .getOriginalElementList()
      .find(el => el.type === ElementType.TABLE)!
    const tableIndex = draw.getOriginalElementList().indexOf(targetTable)
    const targetTd = targetTable.trList![0].tdList[1]

    // Verify elements inside td.value have tdId
    expect(targetTd.value.length).toBeGreaterThan(0)
    for (const el of targetTd.value) {
      expect(el.tdId).toBe(targetTd.id)
      expect(el.trId).toBe(targetTable.trList![0].id)
      expect(el.tableId).toBe(targetTable.id)
    }

    // Set position context inside this cell and set text selection
    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 1,
      tdId: targetTd.id,
      trId: targetTable.trList![0].id,
      tableId: targetTable.id
    })

    draw.getRange().setRange(1, 5)
    expect(draw.getRange().getIsSelection()).toBe(true)

    const selection = draw.getRange().getSelection()
    expect(selection).toBeTruthy()
    expect(selection!.length).toBe(4)

    // Render should succeed without errors and correctly compute range
    expect(() => {
      draw.render({ isSubmitHistory: false })
    }).not.toThrow()

    container.remove()
  })
})
