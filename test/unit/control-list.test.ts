import { describe, it, expect, beforeEach } from 'vitest'
import { Editor } from '../../src/editor'
import { ElementType } from '../../src/editor/dataset/enum/Element'
import { ControlType } from '../../src/editor/dataset/enum/Control'

describe('ListRadioControl & ListCheckboxControl 回显设值测试', () => {
  let container: HTMLDivElement
  let editor: Editor

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('1. 单选控件 ListRadioControl 从占位符回显后应正确展开且无多余节点', () => {
    editor = new Editor(container, {
      main: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'patient.gender',
            type: ControlType.RADIO,
            listType: 'radio',
            placeholder: '患者性别 (List.Radio)',
            layout: 'vertical',
            value: []
          }
        }
      ]
    })

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

    // 第一次设值回显
    editor.command.executeSetControlValueList(payload)
    const elements1 = editor.command.getValue().data.main
    console.log('第一次设值后元素数量:', elements1.length)
    console.log('第一次设值后元素清单:', elements1.map((e: any) => ({ value: e.value, type: e.type, comp: e.controlComponent, radio: e.radio })))

    // 验证第二次设值回显（不应产生多余节点或重复渲染）
    editor.command.executeSetControlValueList(payload)
    const elements2 = editor.command.getValue().data.main
    console.log('第二次设值后元素数量:', elements2.length)
    console.log('第二次设值后元素清单:', elements2.map((e: any) => ({ value: e.value, type: e.type, comp: e.controlComponent, radio: e.radio })))

    expect(elements2.length).toBe(elements1.length)
  })

  it('2. 复选控件 ListCheckboxControl 从占位符回显后应正确展开且无多余节点', () => {
    editor = new Editor(container, {
      main: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'surgery.consent_clauses',
            type: ControlType.CHECKBOX,
            listType: 'checkbox',
            placeholder: '知情同意条款 (List.Checkbox)',
            layout: 'vertical',
            value: []
          }
        }
      ]
    })

    const payload = [
      {
        conceptId: 'surgery.consent_clauses',
        value: [
          { label: '条款1', value: 'clause_1', checked: true },
          { label: '条款2', value: 'clause_2', checked: false },
          { label: '条款3', value: 'clause_3', checked: true }
        ]
      }
    ]

    editor.command.executeSetControlValueList(payload)
    const elements1 = editor.command.getValue().data.main

    editor.command.executeSetControlValueList(payload)
    const elements2 = editor.command.getValue().data.main

    expect(elements2.length).toBe(elements1.length)
  })

  it('3. 用户给控件设置了颜色、字号等样式后，回显数据能完整保留样式', () => {
    editor = new Editor(container, {
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
    const textChars = elements.filter(
      (e: any) => e.value === '张' || e.value === '三'
    )
    expect(textChars.length).toBe(2)
    // 验证新插入的字符保留了之前设置的样式
    expect(textChars[0].color).toBe('#FF0000')
    expect(textChars[0].size).toBe(20)
    expect(textChars[0].bold).toBe(true)
    expect(textChars[0].underline).toBe(true)
  })

  it('4. 回显数据异常或不存在时自动使用 defaultValue，且 0 与 false 作为合法值予以保留', () => {
    editor = new Editor(container, {
      main: [
        // 控件 1：配置了 defaultValue = '默认科室'，payload 传入 null，应 fallback 为 '默认科室'
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'patient.dept',
            type: ControlType.TEXT,
            placeholder: '就诊科室',
            defaultValue: '心血管内科',
            value: null
          }
        },
        // 控件 2：数值为 0，应正常回显 0，不被 fallback
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'test.zero',
            type: ControlType.TEXT,
            placeholder: '数值零',
            defaultValue: '999',
            value: null
          }
        },
        // 控件 3：布尔值为 false，应正常回显 false，不被 fallback
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'test.false',
            type: ControlType.TEXT,
            placeholder: '布尔假',
            defaultValue: 'true',
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

    // 检查 patient.dept 是否展示了 defaultValue '心血管内科'
    const deptChars = elements
      .filter((e: any) => e.control?.conceptId === 'patient.dept' && e.controlComponent === 'value')
      .map((e: any) => e.value)
      .join('')
    expect(deptChars).toContain('心血管内科')

    // 检查 test.zero 是否展示了 '0' 而不是 '999'
    const zeroChars = elements
      .filter((e: any) => e.control?.conceptId === 'test.zero' && e.controlComponent === 'value')
      .map((e: any) => e.value)
      .join('')
    expect(zeroChars).toBe('0')

    // 检查 test.false 是否展示了 'false' 而不是 'true'
    const falseChars = elements
      .filter((e: any) => e.control?.conceptId === 'test.false' && e.controlComponent === 'value')
      .map((e: any) => e.value)
      .join('')
    expect(falseChars).toBe('false')
  })
})
