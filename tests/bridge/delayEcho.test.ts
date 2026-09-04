import { describe, it, expect } from 'vitest'
import { expandLoopTables } from '../../src/bridge/editorBridge'
import { deepClone } from '../../src/editor/utils'

describe('延迟回显与异步数据加载时序测试', () => {
  it('当 JSON 模板中 control 控件漏打 innerLoop 标记时，自愈补齐并正确展开 3 条规则', () => {
    const tableTemplate = {
      type: 'table',
      trList: [
        {
          tdList: [
            {
              value: [
                {
                  type: 'checkbox',
                  value: '',
                  checkbox: { value: false },
                  innerLoop: {
                    isLoop: true,
                    datasetId: 'riskRuleList',
                    itemAlias: 'rule',
                    isBlock: true,
                    loopBlockId: '171d4e47-fabd-df69-6a5e-79f91636bf2a'
                  }
                },
                {
                  type: 'control',
                  value: '',
                  control: {
                    type: 'text',
                    conceptId: 'riskLevelName',
                    placeholder: 'rule.riskLevelName'
                  }
                  // 注意：这里故意不带 innerLoop，模拟用户提供的真实有缺陷 JSON
                },
                {
                  value: '：',
                  innerLoop: {
                    isLoop: true,
                    datasetId: 'riskRuleList',
                    itemAlias: 'rule',
                    isBlock: true,
                    loopBlockId: '171d4e47-fabd-df69-6a5e-79f91636bf2a'
                  }
                },
                {
                  type: 'control',
                  value: '',
                  control: {
                    type: 'text',
                    conceptId: 'desc',
                    placeholder: 'rule.desc'
                  }
                  // 注意：这里也故意不带 innerLoop
                }
              ]
            }
          ]
        }
      ]
    }

    const businessData = {
      riskRuleList: [
        {
          riskLevelName: '重大风险',
          desc: '关键项不符合 ≥ 1项 或 得分 < 70分',
          isChecked: true
        },
        {
          riskLevelName: '较大风险',
          desc: '关键项不符合 < 1项 且 得分 介于 70分-85分',
          isChecked: false
        },
        {
          riskLevelName: '一般风险',
          desc: '关键项不符合 < 1项 且 得分 ≥ 85分',
          isChecked: false
        }
      ]
    }

    const docList = [deepClone(tableTemplate)]
    expandLoopTables(docList, businessData)

    const cellNodes = docList[0].trList[0].tdList[0].value
    const textResult = cellNodes.map((v: any) => v.value || '').join('')

    console.log('--- 展开后的画布字符文本 ---', textResult)

    const checkboxes = cellNodes.filter((v: any) => v.type === 'checkbox')
    expect(checkboxes.length).toBe(3)
    expect(checkboxes[0]?.checkbox?.value).toBe(true)
    expect(checkboxes[1]?.checkbox?.value).toBe(false)
    expect(checkboxes[2]?.checkbox?.value).toBe(false)

    expect(textResult).toContain('{重大风险}')
    expect(textResult).toContain('{较大风险}')
    expect(textResult).toContain('{一般风险}')
  })
})
