import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
;(globalThis as any).DOMParser = dom.window.DOMParser
;(globalThis as any).Node = dom.window.Node
;(globalThis as any).HTMLElement = dom.window.HTMLElement

import { Editor } from '../src/editor'
import { EditorBridge } from '../src/bridge/editorBridge'

const container = dom.window.document.getElementById('editor')!

const templateData = {
  version: '0.9.137',
  data: {
    header: [],
    main: [
      {
        value: '',
        type: 'table',
        trList: [
          {
            height: 42,
            tdList: [
              {
                value: [{ value: '标化分' }]
              },
              {
                value: [
                  {
                    type: 'control',
                    value: '',
                    control: {
                      type: 'text',
                      conceptId: 'standardizedScore',
                      placeholder: 'standardizedScore'
                    }
                  },
                  { value: ' 分' }
                ]
              }
            ]
          },
          {
            height: 67,
            tdList: [
              {
                value: [{ value: '风险级别' }]
              },
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
                    },
                    innerLoop: {
                      isLoop: true,
                      datasetId: 'riskRuleList',
                      itemAlias: 'rule',
                      isBlock: true,
                      loopBlockId: '171d4e47-fabd-df69-6a5e-79f91636bf2a'
                    }
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
                    },
                    innerLoop: {
                      isLoop: true,
                      datasetId: 'riskRuleList',
                      itemAlias: 'rule',
                      isBlock: true,
                      loopBlockId: '171d4e47-fabd-df69-6a5e-79f91636bf2a'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}

const businessData = {
  standardizedScore: 104.67,
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

// 模拟初始化
const editor = new Editor(container, templateData.data, { mode: 'edit' })
const bridge = new EditorBridge({ instance: editor })

console.log('=== 步骤 1：仅加载模板（无数据） ===')
// 检查初始画布上的表格结构
const initialElements = editor.command.getValue().data.main
console.log('初始画布表格行数:', initialElements[0].trList.length)

console.log('=== 步骤 2：5秒后延迟传入 businessData 调用 setControlValueList ===')
bridge.setControlValueList(businessData)

const updatedElements = editor.command.getValue().data.main
const riskTd = updatedElements[0].trList[1].tdList[1]
console.log('--- 延迟回显后的 riskTd 文本 ---')
console.log(riskTd.value.map((v: any) => v.value).join(''))
console.log('--- riskTd 完整节点 ---')
console.log(JSON.stringify(riskTd.value, null, 2))
