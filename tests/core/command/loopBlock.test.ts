import { describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../../factories/editor'
import { EditorBridge } from '@/bridge/editorBridge'
import { ElementType } from '@/editor/dataset/enum/Element'
import { ControlType } from '@/editor/dataset/enum/Control'

function makeCtrl(conceptId: string, placeholder: string) {
  return {
    type: ElementType.CONTROL,
    value: '',
    control: { conceptId, type: ControlType.TEXT, placeholder, value: null }
  }
}

describe('EditorBridge 循环块展开(合并单元格)', () => {
  it('内容行+空白行组成的循环块按数据条数复制,rowspan 保留', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    const bridge = new EditorBridge({
      instance: editor,
      updateComponents: vi.fn(),
      setCustomConfig: vi.fn()
    })
    const template = {
      main: [
        {
          type: ElementType.TABLE,
          value: '',
          width: 500,
          height: 72,
          colgroup: [{ width: 200 }, { width: 200 }, { width: 100 }],
          trList: [
            // 表头行
            {
              height: 36,
              tdList: [
                { colspan: 1, rowspan: 1, value: [{ value: '药品名称' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '用法用量' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '天数' }] }
              ]
            },
            // 循环块起始行(第1列 rowspan=2 合并到空白行)
            {
              height: 36,
              loopConfig: {
                datasetId: 'medication_records',
                isLoopRow: true,
                endTrIndex: 2
              },
              tdList: [
                {
                  colspan: 1,
                  rowspan: 2,
                  value: [makeCtrl('drug_name', '药品名称')]
                },
                {
                  colspan: 1,
                  rowspan: 1,
                  value: [makeCtrl('drug_usage', '用法用量')]
                },
                {
                  colspan: 1,
                  rowspan: 1,
                  value: [makeCtrl('drug_days', '用药天数')]
                }
              ]
            },
            // 空白行(循环块结束行,第1列被 rowspan 覆盖)
            {
              height: 36,
              tdList: [
                { colspan: 1, rowspan: 1, value: [{ value: '' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '' }] }
              ]
            }
          ]
        }
      ]
    }
    const businessData = {
      medication_records: [
        { drug_name: '阿莫西林', drug_usage: '口服0.5g/次', drug_days: '7天' },
        { drug_name: '布洛芬', drug_usage: '口服0.3g/次', drug_days: '3天' }
      ]
    }

    // 传入 businessData 时直接在 render 时完成循环块展开与回显
    ;(bridge as any).executeRenderPayload(
      { template, businessData },
      { updateComponents: vi.fn(), setCustomConfig: vi.fn() }
    )
    let original = (editor.command as any).getOriginalElementList()
    const tableAfter = original.find(
      (el: any) => el.type === ElementType.TABLE
    )
    expect(tableAfter.trList.length).toBe(5)
    // rowspan 保留(每份块的第1行第1列 rowspan=2;展开后 loopConfig 已清理防二次展开)
    const rowspans = tableAfter.trList.map((tr: any) => tr.tdList[0]?.rowspan)
    expect(rowspans).toEqual([1, 2, 1, 2, 1])
    // 文本回显
    expect(editor.command.getText().main).toContain('阿莫西林')
    expect(editor.command.getText().main).toContain('布洛芬')

    // 重复调用 setControlValueList 保证幂等防二次展开
    bridge.setControlValueList()
    original = (editor.command as any).getOriginalElementList()
    expect(
      original.find((el: any) => el.type === ElementType.TABLE).trList.length
    ).toBe(5)

    // 重复 fillData 幂等(仍 5 行)
    bridge.setControlValueList()
    original = (editor.command as any).getOriginalElementList()
    const tableIdempotent = original.find(
      (el: any) => el.type === ElementType.TABLE
    )
    expect(tableIdempotent.trList.length).toBe(5)

    destroy()
  })
})
