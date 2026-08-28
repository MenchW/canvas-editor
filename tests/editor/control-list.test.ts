import { describe, it, expect, beforeEach } from 'vitest'
import { Editor } from '../../src/editor'
import { ElementType } from '../../src/editor/dataset/enum/Element'
import { ControlType } from '../../src/editor/dataset/enum/Control'
import { EditorMode } from '../../src/editor/dataset/enum/Editor'

describe('ListRadioControl & ListCheckboxControl 真实场景还原测试', () => {
  let container: HTMLDivElement
  let editor: Editor

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('3. 初始模板已带 valueSets 的单选控件在回显设值时', () => {
    editor = new Editor(container, {
      main: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'patient.gender',
            type: ControlType.RADIO,
            value: null,
            code: '1',
            valueSets: [
              { value: '男', code: '1' },
              { value: '女', code: '2' },
              { value: '未知', code: '0' }
            ]
          }
        }
      ]
    })

    const initialResult = editor.command.getValue().data.main
    console.log('初始 Main 元素清单:')
    console.log(initialResult.map((e: any, idx: number) => ({
      idx,
      value: e.value,
      type: e.type,
      comp: e.controlComponent,
      controlId: e.controlId,
      radio: e.radio
    })))

    const payload = [
      {
        conceptId: 'patient.gender',
        value: [
          { label: '男', value: '1', checked: false },
          { label: '女', value: '2', checked: true },
          { label: '未知', value: '0', checked: false }
        ]
      }
    ]

    editor.command.executeSetControlValueList(payload)

    const afterResult = editor.command.getValue().data.main
    console.log('回显设值后 Main 元素清单:')
    console.log(afterResult.map((e: any, idx: number) => ({
      idx,
      value: e.value,
      type: e.type,
      comp: e.controlComponent,
      controlId: e.controlId,
      radio: e.radio
    })))

    expect(afterResult.length).toBe(initialResult.length)
  })

  it('大标题复合检验报告集 (通栏合并 + 明细循环 + 单元格嵌套多图) 回显测试', async () => {
    const { parseTableHtml } = await import('../../src/utils')
    const { EditorBridge } = await import('../../src/bridge/editorBridge')

    const html = `<table border="1">
      <thead>
        <tr>
          <th>检测项目</th>
          <th>结果数值</th>
          <th>参考范围</th>
          <th>化验报告影像 (多图)</th>
        </tr>
      </thead>
      <tbody loop="group in composite.grouped_report">
        <tr>
          <td colspan="4" align="left" style="background:#F2F4F8;"><b>■ {{ group.title }}</b></td>
        </tr>
        <tr loop="item in group.children">
          <td>{{ item.itemName }}</td>
          <td>{{ item.result }}</td>
          <td>{{ item.reference }}</td>
          <td>{{ item.imgList }}</td>
        </tr>
      </tbody>
    </table>`

    const tableEl = parseTableHtml(html, { defaultConceptId: 'composite.grouped_report' })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, [tableEl])

    const bridge = new EditorBridge({ instance: editor })
    const mockBusinessData = {
      composite: {
        grouped_report: [
          {
            title: '一、血常规检查组 (WBC/RBC/PLT/HGB)',
            children: [
              {
                itemName: '白细胞计数 (WBC)',
                result: '11.2 ↑',
                reference: '4.0-10.0',
                imgList: [
                  'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
                  'https://gips1.baidu.com/it/u=3874035412,3044192377&fm=3028&app=3028&f=JPEG?w=1024&h=1024'
                ]
              },
              {
                itemName: '红细胞计数 (RBC)',
                result: '4.55',
                reference: '3.5-5.5',
                imgList: []
              }
            ]
          },
          {
            title: '二、尿液常规分析组',
            children: [
              {
                itemName: '尿蛋白 (PRO)',
                result: '阴性 (-)',
                reference: '阴性',
                imgList: []
              }
            ]
          }
        ]
      }
    }

    bridge.setControlValueList(mockBusinessData)

    const renderedTable = editor.command.getValue().data.main[0]
    expect(renderedTable.type).toBe('table')
    // 总行数 = 1 表头 + (1大标题 + 2明细) + (1大标题 + 1明细) = 6 行
    expect(renderedTable.trList!.length).toBe(6)

    // 检查第 1 组大标题
    const group1Header = renderedTable.trList![1].tdList[0]
    expect(group1Header.value.map((v: any) => v.value).join('')).toContain('一、血常规检查组')

    // 检查第 1 组第 1 行多图
    const imgTd = renderedTable.trList![2].tdList[3]
    const imgNodes = imgTd.value.filter((v: any) => v.type === 'image')
    expect(imgNodes.length).toBe(2)
  })

  it('4. 用户给控件设置了颜色、字号等样式后，回显数据能完整保留样式', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, {
      main: [
        {
          type: ElementType.CONTROL,
          value: '',
          color: '#FF0000',
          size: 20,
          bold: true,
          underline: true,
          control: {
            conceptId: 'patient.name',
            type: ControlType.TEXT,
            placeholder: '患者姓名',
            value: null
          }
        }
      ]
    })

    editor.command.executeSetControlValueList([
      { conceptId: 'patient.name', value: '张三' }
    ])

    const elements = editor.command.getValue().data.main
    const textNode = (elements[0].control?.value as any)?.[0]
    expect(textNode).toBeDefined()
    expect(textNode.value).toBe('张三')
    // 验证新插入的字符保留了之前设置的样式
    expect(textNode.color).toBe('#FF0000')
    expect(textNode.size).toBe(20)
    expect(textNode.bold).toBe(true)
    expect(textNode.underline).toBe(true)
  })

  it('5. 宿主下发数据驱动回显：0 与 false 作为合法值予以保留，null/空置为空', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, {
      main: [
        // 控件 1：下发 null，应置空（无值）
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'patient.dept',
            type: ControlType.TEXT,
            placeholder: '就诊科室',
            value: null
          }
        },
        // 控件 2：数值为 0，应正常回显 0
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'test.zero',
            type: ControlType.TEXT,
            placeholder: '数值零',
            value: null
          }
        },
        // 控件 3：布尔值为 false，应正常回显 false
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'test.false',
            type: ControlType.TEXT,
            placeholder: '布尔假',
            value: null
          }
        }
      ]
    })

    editor.command.executeSetControlValueList([
      { conceptId: 'patient.dept', value: null },
      { conceptId: 'test.zero', value: 0 },
      { conceptId: 'test.false', value: false }
    ])

    const elements = editor.command.getValue().data.main

    // 检查 patient.dept 是否为空（未设值）
    const deptControl = elements.find((e: any) => e.control?.conceptId === 'patient.dept')
    expect(deptControl?.control?.value).toBeFalsy()

    // 检查 test.zero 是否展示了 '0'
    const zeroControl = elements.find((e: any) => e.control?.conceptId === 'test.zero')
    const zeroChars = zeroControl?.control?.value?.map((e: any) => e.value).join('') || ''
    expect(zeroChars).toBe('0')

    // 检查 test.false 是否展示了 'false'
    const falseControl = elements.find((e: any) => e.control?.conceptId === 'test.false')
    const falseChars = falseControl?.control?.value?.map((e: any) => e.value).join('') || ''
    expect(falseChars).toBe('false')
  })

  it('6. List.Text (多行分段列表) 与 List.Checkbox (多选条款) 数据回显', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, {
      main: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'diagnose.items',
            type: ControlType.TEXT,
            listType: 'text',
            placeholder: '临床诊断列表',
            value: null
          }
        },
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'surgery.consent',
            type: ControlType.CHECKBOX,
            listType: 'checkbox',
            placeholder: '知情同意条款',
            value: null
          }
        }
      ]
    })

    editor.command.executeSetControlValueList([
      {
        conceptId: 'diagnose.items',
        value: [
          { label: '1. 高血压3级（极高危）', code: 'item_1' },
          { label: '2. 冠心病（心绞痛）', code: 'item_2' }
        ]
      },
      {
        conceptId: 'surgery.consent',
        value: [
          { label: '条款一：已知悉诊疗风险', value: 'clause_1', checked: true },
          { label: '条款二：完成术前凝血筛查', value: 'clause_2', checked: false },
          { label: '条款三：核实无麻醉过敏史', value: 'clause_3', checked: true }
        ]
      }
    ])

    const elements = editor.command.getValue().data.main
    const diagControl = elements.find((e: any) => e.control?.conceptId === 'diagnose.items')
    const consentControl = elements.find((e: any) => e.control?.conceptId === 'surgery.consent')

    expect(diagControl).toBeDefined()
    expect(consentControl).toBeDefined()
    if (consentControl) {
      expect(consentControl.control?.code).toContain('clause_1')
      expect(consentControl.control?.code).toContain('clause_3')
    }
  })

  it('7. executeConvertControlToText (控件一键脱壳转纯文本) 与 getControlValue/getControlList', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, {
      main: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'patient.name',
            type: ControlType.TEXT,
            placeholder: '患者姓名',
            value: null
          }
        }
      ]
    })

    // 回显设值
    editor.command.executeSetControlValueList([
      { conceptId: 'patient.name', value: '李四' }
    ])

    // 验证 getControlValue 与 getControlList
    const controlValues = editor.command.getControlValue({ conceptId: 'patient.name' })
    expect(controlValues).toBeDefined()
    expect(controlValues?.[0]?.value).toBe('李四')

    const controlList = editor.command.getControlList()
    expect(controlList.length).toBeGreaterThan(0)
    expect(controlList[0].control?.conceptId).toBe('patient.name')

    // 执行脱壳转纯文本
    editor.command.executeConvertControlToText()

    const rawElements = editor.command.getValue().data.main
    // 脱壳后不应存在 CONTROL 类型的节点
    const hasControl = rawElements.some((e: any) => e.type === ElementType.CONTROL || e.control)
    expect(hasControl).toBe(false)
    const textCombined = rawElements.map((e: any) => e.value).join('')
    expect(textCombined).toContain('李四')
  })

  it('8. executeRecoveryHistory (历史基准重置 API)', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, {
      main: [{ value: '初始文档内容' }]
    }, {
      mode: EditorMode.EDIT
    })

    editor.command.executeFocus()
    editor.command.executeInsertElementList([{ value: '追加内容' }])
    const contentAfterInsert = editor.command.getValue().data.main.map((e: any) => e.value).join('')
    expect(contentAfterInsert).toContain('追加内容')

    // 回显完成后重置历史基准
    editor.command.executeRecoveryHistory()

    // 重置后历史栈被清空，执行 undo 不会撤销掉已固化的内容
    editor.command.executeUndo()
    const contentAfterUndo = editor.command.getValue().data.main.map((e: any) => e.value).join('')
    expect(contentAfterUndo).toContain('追加内容')
  })
})
