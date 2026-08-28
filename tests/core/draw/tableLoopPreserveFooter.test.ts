import { describe, expect, it } from 'vitest'
import { applyGenericDataEngine } from '../../../src/editor/utils/dataEngine'
import { ElementType } from '../../../src/editor/dataset/enum/Element'

describe('通用表格数据驱动引擎 (支持表头、循环明细、表尾合计合并行)', () => {
  it('应成功展开明细循环行，并 100% 完整保留表尾合计合并行 (colspan=2)', () => {
    // 构建评分汇总表模板：
    // 第 0 行：表头 [序号, 项目, 分值, 得分]
    // 第 1 行：明细模板行 (isLoopRow = true)
    // 第 2 行：表尾合计行 (前两列合并为 合计 colspan=2, 分值合计 250, 得分合计 238)
    const tableElement: any = {
      type: ElementType.TABLE,
      conceptId: 'score_sheet.items',
      trList: [
        {
          height: 35,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: '序号' }] },
            { colspan: 1, rowspan: 1, value: [{ value: '项目' }] },
            { colspan: 1, rowspan: 1, value: [{ value: '分值' }] },
            { colspan: 1, rowspan: 1, value: [{ value: '得分' }] }
          ]
        },
        {
          height: 35,
          loopConfig: {
            isLoopRow: true,
            datasetId: 'score_sheet.items'
          },
          tdList: [
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: { conceptId: 'index', placeholder: '{序号}' }
                }
              ]
            },
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: { conceptId: 'item_name', placeholder: '{项目}' }
                }
              ]
            },
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: { conceptId: 'max_score', placeholder: '{分值}' }
                }
              ]
            },
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: { conceptId: 'actual_score', placeholder: '{得分}' }
                }
              ]
            }
          ]
        },
        {
          height: 35,
          tdList: [
            {
              colspan: 2,
              rowspan: 1,
              value: [{ value: '合' }, { value: '计', bold: true }]
            },
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: { conceptId: 'score_sheet.total_max', placeholder: '{250}' }
                }
              ]
            },
            {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: { conceptId: 'score_sheet.total_actual', placeholder: '{238}' }
                }
              ]
            }
          ]
        }
      ]
    }

    const businessData = {
      score_sheet: {
        total_max: 250,
        total_actual: 238,
        items: [
          { index: 1, item_name: '资质与制度体系（关键）', max_score: 100, actual_score: 88 },
          { index: 2, item_name: '加工制作过程（合理）', max_score: 100, actual_score: 100 },
          { index: 3, item_name: '餐前准备（普通）', max_score: 50, actual_score: 50 }
        ]
      }
    }

    applyGenericDataEngine([tableElement], businessData)

    // 验证行数：1 (表头) + 3 (明细) + 1 (表尾合计) = 5 行
    expect(tableElement.trList.length).toBe(5)

    // 验证第 0 行：表头完整
    expect(tableElement.trList[0].tdList[0].value[0].value).toBe('序号')
    expect(tableElement.trList[0].tdList[1].value[0].value).toBe('项目')

    // 验证第 1~3 行：明细展开正确
    expect(tableElement.trList[1].tdList[1].value.map((v: any) => v.value).join('')).toBe('资质与制度体系（关键）')
    expect(tableElement.trList[2].tdList[1].value.map((v: any) => v.value).join('')).toBe('加工制作过程（合理）')
    expect(tableElement.trList[3].tdList[1].value.map((v: any) => v.value).join('')).toBe('餐前准备（普通）')

    // 验证第 4 行（表尾合计行）：colspan: 2 合并单元格与内容 100% 完整保留！
    const footerTr = tableElement.trList[4]
    expect(footerTr.tdList[0].colspan).toBe(2)
    expect(footerTr.tdList[0].value.map((v: any) => v.value).join('')).toBe('合计')
  })
})
