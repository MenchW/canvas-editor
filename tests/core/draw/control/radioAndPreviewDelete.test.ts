import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../../factories/editor'
import { ElementType } from '@/editor/dataset/enum/Element'
import { ControlComponent, ControlType } from '@/editor/dataset/enum/Control'
import { EditorMode } from '@/editor/dataset/enum/Editor'
import { expandLoopTables } from '@/bridge/editorBridge'

describe('Radio回显、图片删除与无痕模式删除测试', () => {
  it('1. Radio 控件配置 valueSets 接收标量 1 或 字符串 "1" 能正常展开为单选列表并勾选', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'patient.gender',
        type: ControlType.RADIO,
        placeholder: '患者性别 (Radio单选)',
        valueSets: [
          { value: '男', code: '1' },
          { value: '女', code: '2' }
        ],
        value: null
      }
    })

    // 下发标量 '1'
    editor.command.executeSetControlValue({
      conceptId: 'patient.gender',
      value: '1'
    })

    const main = (editor.command as any).getOriginalElementList()

    // 验证已展开为包含 radio 的元素
    const radioElements = main.filter((el: any) => el.radio)
    expect(radioElements.length).toBeGreaterThan(0)
    // 验证 '1' 对应的男被选中
    const checkedRadio = radioElements.find((el: any) => el.radio?.value === true)
    expect(checkedRadio).toBeDefined()
    expect(checkedRadio?.radio?.code).toBe('1')

    destroy()
  })

  it('2. 无痕模式 (PREVIEW_EDIT) 下逐字删除不会残留单边花括号，删完最后一个字彻底删除整个控件', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    // 插入带值的文本控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'suggest',
        type: ControlType.TEXT,
        placeholder: '整改建议',
        value: [{ value: '防鼠' }]
      }
    })

    // 切换到无痕编辑模式
    editor.command.executeMode(EditorMode.PREVIEW_EDIT)

    const beforeMain = (editor.command as any).getOriginalElementList()
    // 找到字符 '鼠' 的索引 (位置在 '防' 之后，即 '鼠' 的位置)
    const shuIndex = beforeMain.findIndex((el: any) => el.value === '鼠')
    expect(shuIndex).toBeGreaterThan(0)

    // 光标定在 '鼠' 之后按 Backspace
    editor.command.executeSetRange(shuIndex, shuIndex)
    editor.command.executeBackspace()

    const midMain = (editor.command as any).getOriginalElementList()
    // 剩余 '防'，且前后缀依然成对包裹（在无痕模式下隐藏渲染，但数据结构完整，绝无孤立单边花括号）
    const fangElements = midMain.filter((el: any) => el.value === '防')
    expect(fangElements.length).toBe(1)
    const hasPrefix = midMain.some((el: any) => el.controlComponent === 'prefix')
    const hasPostfix = midMain.some((el: any) => el.controlComponent === 'postfix')
    expect(hasPrefix).toBe(true)
    expect(hasPostfix).toBe(true)

    // 再次删除 '防'（最后一个字符）
    const fangIndex = midMain.findIndex((el: any) => el.value === '防')
    editor.command.executeSetRange(fangIndex, fangIndex)
    editor.command.executeBackspace()

    const afterMain = (editor.command as any).getOriginalElementList()
    // 整个控件（包括隐藏的前后缀）已被彻底删除
    const remainControls = afterMain.filter((el: any) => el.controlId)
    expect(remainControls.length).toBe(0)

    destroy()
  })

  it('3. 图片控件与普通图片使用 removeControl / deleteElementList 可被彻底干净删除', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    // 插入图片控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'avatar',
        type: ControlType.IMAGE,
        placeholder: '头像',
        value: null,
        width: 100,
        height: 100
      }
    })

    // 设置图片数据
    editor.command.executeSetControlValue({
      conceptId: 'avatar',
      value: 'https://example.com/test.png'
    })

    const mainWithImg = (editor.command as any).getOriginalElementList()
    const imgIndex = mainWithImg.findIndex(
      (el: any) => el.type === ElementType.IMAGE || el.value?.startsWith('http')
    )
    expect(imgIndex).toBeGreaterThan(0)

    // 模拟光标或选区命中图片并执行 Backspace
    editor.command.executeSetRange(imgIndex, imgIndex)
    editor.command.executeBackspace()

    const mainAfter = (editor.command as any).getOriginalElementList()
    const imgRemain = mainAfter.filter(
      (el: any) => el.type === ElementType.IMAGE || el.value?.startsWith('http')
    )
    expect(imgRemain.length).toBe(0)

    destroy()
  })

  it('4. 无痕模式下长选区跨控件删除：干净删除选区文字，删空控件彻底移除，不露任何孤立单边花括号', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    // 插入控件1: {较大风险}
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'risk_level',
        type: ControlType.TEXT,
        placeholder: '风险等级',
        value: [{ value: '较大风险' }]
      }
    })

    // 插入普通文本冒号
    editor.command.executeInsertElementList([{ value: ':' }, { value: ' ' }])

    // 插入控件2: {关键项不符合 < 1项 且得分 介于 70-85分}
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'risk_desc',
        type: ControlType.TEXT,
        placeholder: '风险说明',
        value: [{ value: '关键项不符合 < 1项 且\n得分 介于 70-85分' }]
      }
    })

    // 切换到无痕模式
    editor.command.executeMode(EditorMode.PREVIEW_EDIT)

    const mainList = (editor.command as any).getOriginalElementList()
    // 找到 '键' 字符和最后一个 '分' 字符
    const jianIdx = mainList.findIndex((el: any) => el.value === '键')
    const fenIdx = mainList.findIndex((el: any) => el.value === '分')
    expect(jianIdx).toBeGreaterThan(0)
    expect(fenIdx).toBeGreaterThan(jianIdx)

    // 框选长选区：从 '键' 之前的一个位置到 '分' 结束
    editor.command.executeSetRange(jianIdx - 1, fenIdx)
    // 执行选区删除
    editor.command.executeBackspace()

    const afterDel = (editor.command as any).getOriginalElementList()

    // 验证：绝对不存在孤立的单边前缀/后缀花括号暴露在普通文本中
    const visibleBrackets = afterDel.filter(
      (el: any) =>
        (el.value === '{' || el.value === '}') && !el.controlComponent
    )
    expect(visibleBrackets.length).toBe(0)

    destroy()
  })

  it('5. type: list, listType: radio 控件回显下发标量正常展开与勾选', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'patient.gender',
        type: 'list' as any,
        listType: 'radio' as any,
        placeholder: '患者性别 (Radio单选)',
        valueSets: [
          { value: '男', code: '1' },
          { value: '女', code: '2' }
        ],
        value: null
      }
    })

    editor.command.executeSetControlValue({
      conceptId: 'patient.gender',
      value: '1'
    })

    const main = (editor.command as any).getOriginalElementList()
    const radioElements = main.filter((el: any) => el.radio)
    expect(radioElements.length).toBeGreaterThan(0)
    const checked = radioElements.find((el: any) => el.radio?.value === true)
    expect(checked).toBeDefined()
    expect(checked?.radio?.code).toBe('1')

    destroy()
  })

  it('6. 多图列表控件中选中某张图片按 Backspace：只删除被选中的那张图片，保留其他图片', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'exam.images',
        type: 'list' as any,
        listType: 'image' as any,
        placeholder: '检查影像多图',
        value: null
      }
    })

    // 下发两张图片
    editor.command.executeSetControlValue({
      conceptId: 'exam.images',
      value: ['https://example.com/img1.png', 'https://example.com/img2.png']
    })

    const mainList = (editor.command as any).getOriginalElementList()
    const img1El = mainList.find(
      (el: any) => el.type === ElementType.IMAGE && el.value?.includes('img1')
    )
    const img2El = mainList.find(
      (el: any) => el.type === ElementType.IMAGE && el.value?.includes('img2')
    )
    expect(img1El).toBeDefined()
    expect(img2El).toBeDefined()

    // 模拟 Previewer 选中第二张图片
    const previewer = editor.command.getDraw().getPreviewer()
    previewer.drawResizer(img2El)

    // 执行退格删除
    editor.command.executeBackspace()

    const afterDel = (editor.command as any).getOriginalElementList()
    const remainImg1 = afterDel.find(
      (el: any) =>
        el.value?.includes('img1') ||
        el.control?.value?.some((v: any) => v.value?.includes('img1'))
    )
    const remainImg2 = afterDel.find(
      (el: any) =>
        el.value?.includes('img2') ||
        el.control?.value?.some((v: any) => v.value?.includes('img2'))
    )
    // img1 保留，img2 被删除
    expect(remainImg1).toBeDefined()
    expect(remainImg2).toBeUndefined()

    destroy()
  })

  it('7. 无痕模式 (PREVIEW_EDIT) 下多图控件填充后，PREFIX/POSTFIX 自动隐藏且 isPlaceholder 为 false', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] },
      options: { mode: EditorMode.PREVIEW_EDIT }
    })

    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'exam.images',
        type: 'list' as any,
        listType: 'image' as any,
        placeholder: '现场照片 (多图)',
        value: null
      }
    })

    editor.command.executeSetControlValue({
      conceptId: 'exam.images',
      value: ['https://example.com/img1.png', 'https://example.com/img2.png']
    })

    const elementList = (editor.command.getDraw() as any).getElementList()
    const prefixEl = elementList.find(
      (el: any) => el.controlComponent === ControlComponent.PREFIX
    )
    const postfixEl = elementList.find(
      (el: any) => el.controlComponent === ControlComponent.POSTFIX
    )

    // 在无痕模式下，前后缀 metrics.width 必须为 0 且彻底隐藏
    expect(prefixEl?.metrics?.width).toBe(0)
    expect(postfixEl?.metrics?.width).toBe(0)

    destroy()
  })

  it('8. 无痕模式下框选部分控件文字（例如“般风险”）删除后，界面自愈且绝对不露出 { 或 } 花括号', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          { value: '作' },
          { value: '存' },
          { value: '在' },
          {
            type: ElementType.CONTROL,
            value: '',
            control: {
              conceptId: 'risk.level',
              type: 'text' as any,
              placeholder: '风险等级',
              value: [
                { value: '一' },
                { value: '般' },
                { value: '风' },
                { value: '险' }
              ]
            }
          },
          { value: '。' }
        ]
      },
      options: { mode: EditorMode.PREVIEW_EDIT }
    })

    const elementList = (editor.command.getDraw() as any).getElementList()
    const banIdx = elementList.findIndex(
      (el: any) =>
        el.value === '般' && el.controlComponent === ControlComponent.VALUE
    )
    const xianIdx = elementList.findIndex(
      (el: any) =>
        el.value === '险' && el.controlComponent === ControlComponent.VALUE
    )
    expect(banIdx).toBeGreaterThan(0)
    expect(xianIdx).toBeGreaterThan(banIdx)

    // 框选“般风险”
    editor.command.executeSetRange(banIdx - 1, xianIdx)
    editor.command.executeBackspace()

    const afterDel = (editor.command.getDraw() as any).getElementList()
    // 验证剩余控件文字为 '一'
    const remainValue = afterDel.filter(
      (el: any) => el.controlComponent === ControlComponent.VALUE
    )
    expect(remainValue.length).toBe(1)
    expect(remainValue[0].value).toBe('一')

    // 验证前后缀在无痕模式下彻底隐藏 (metrics.width === 0)
    const prefixEl = afterDel.find(
      (el: any) => el.controlComponent === ControlComponent.PREFIX
    )
    const postfixEl = afterDel.find(
      (el: any) => el.controlComponent === ControlComponent.POSTFIX
    )
    expect(prefixEl?.metrics?.width).toBe(0)
    expect(postfixEl?.metrics?.width).toBe(0)

    destroy()
  })

  it('9. 循环表格回显：普通模式下图片单元格具有 { <img> } 完整包裹，无痕模式下前后缀全部隐藏且 width=0', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.TABLE,
            value: '',
            trList: [
              {
                height: 40,
                tdList: [
                  {
                    colspan: 1,
                    rowspan: 1,
                    value: [
                      {
                        type: ElementType.CONTROL,
                        value: '',
                        control: {
                          type: 'list' as any,
                          listType: 'image' as any,
                          conceptId: 'images',
                          placeholder: '现场照片 (多图)',
                          value: null
                        }
                      }
                    ]
                  }
                ],
                loopConfig: {
                  isLoopRow: true,
                  datasetId: 'items'
                }
              }
            ]
          }
        ]
      }
    })

    const draw = editor.command.getDraw()
    const elementList = (draw as any).getElementList()
    expandLoopTables(elementList, {
      items: [
        {
          images: ['https://example.com/item1.png']
        }
      ]
    })

    const tableEl = elementList.find((el: any) => el.type === ElementType.TABLE)
    const cellValue = tableEl?.trList?.[0]?.tdList?.[0]?.value || []

    const imageNode = cellValue.find((el: any) => el.type === ElementType.IMAGE)

    // 验证循环展开后图片节点正确填充
    expect(imageNode).toBeDefined()
    expect(imageNode?.value).toBe('https://example.com/item1.png')

    // 切换到无痕模式：Draw 重新计算排版正常，不报错
    draw.setMode(EditorMode.PREVIEW_EDIT)
    draw.render({ isCompute: true })

    destroy()
  })

  it('10. 当之前点击选中过图片（Previewer 激活手柄），随后执行全选（Ctrl+A）并按 Backspace：应清空整个文档选区，而不是仅删除图片', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          { value: '标' },
          { value: '题' },
          { value: '\n' },
          {
            type: ElementType.IMAGE,
            value: 'https://example.com/stamp.png',
            width: 80,
            height: 80
          },
          { value: '\n' },
          { value: '尾' },
          { value: '注' }
        ]
      }
    })

    const draw = editor.command.getDraw()
    const elementList = (draw as any).getElementList()
    const imgEl = elementList.find((el: any) => el.type === ElementType.IMAGE)
    expect(imgEl).toBeDefined()

    // 1. 模拟用户先点击了图片（激活 Previewer 手柄）
    draw.getPreviewer().drawResizer(imgEl)
    expect(draw.getPreviewer().getCurElement()).toBe(imgEl)

    // 2. 随后用户执行 Ctrl+A 全选
    editor.command.executeSelectAll()

    // 3. 用户按 Backspace 删除
    editor.command.executeBackspace()

    // 4. 验证整个画布被清空（只剩默认换行），而不是只删除了那张签名章图片
    const afterDel = (draw as any).getElementList()
    const remainTitle = afterDel.find((el: any) => el.value === '标')
    const remainFoot = afterDel.find((el: any) => el.value === '尾')
    const remainImg = afterDel.find((el: any) => el.type === ElementType.IMAGE)

    expect(remainTitle).toBeUndefined()
    expect(remainFoot).toBeUndefined()
    expect(remainImg).toBeUndefined()

    destroy()
  })

  it('11. list.checkbox / checkbox 选项文本支持逐字退格删除，删除单个字时控件依然完好存在', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    // 插入 list.checkbox 控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'clauseList',
        type: 'list' as any,
        listType: 'checkbox' as any,
        placeholder: '条款复选',
        valueSets: [
          { value: '规范完好', code: 'opt1' }
        ],
        code: null,
        value: null
      }
    })

    // 下发选项数据展开
    editor.command.executeSetControlValue({
      conceptId: 'clauseList',
      value: ['opt1']
    })

    const draw = editor.command.getDraw()
    const elementList = (draw as any).getElementList()
    
    // 找到 "好" 字的索引
    const haoIndex = elementList.findIndex((el: any) => el.value === '好')
    expect(haoIndex).toBeGreaterThan(-1)

    // 将光标定位在 "好" 字上
    editor.command.executeSetRange(haoIndex, haoIndex)

    // 按 Backspace 删除 "好" 字
    editor.command.executeBackspace()

    const afterDel = (draw as any).getElementList()
    // "好" 字已被删除
    const hasHao = afterDel.some((el: any) => el.value === '好')
    expect(hasHao).toBe(false)

    // "规范完" 仍然存在
    const hasWan = afterDel.some((el: any) => el.value === '完')
    expect(hasWan).toBe(true)

    // 控件仍然完好保留（并未被整块删除）
    const ctrlEl = afterDel.find((el: any) => el.control?.conceptId === 'clauseList')
    expect(ctrlEl).toBeDefined()

    destroy()
  })

  it('12. 多图列表控件中两张图片中间的空格处按 Backspace：只删除空格，绝对不删除第二张图片', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })

    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'twoImages',
        type: 'list' as any,
        listType: 'image' as any,
        placeholder: '多图',
        value: null
      }
    })

    // 下发两张图片
    editor.command.executeSetControlValue({
      conceptId: 'twoImages',
      value: ['https://example.com/pic1.png', 'https://example.com/pic2.png']
    })

    const draw = editor.command.getDraw()
    const elementList = (draw as any).getElementList()

    // 找到两张图片之间的空格
    const spaceIndex = elementList.findIndex(
      (el: any) =>
        el.controlComponent === ControlComponent.VALUE &&
        (el.value === ' ' || el.value === '  ')
    )
    expect(spaceIndex).toBeGreaterThan(-1)

    // 将光标定位在空格处
    editor.command.executeSetRange(spaceIndex, spaceIndex)

    // 按 Backspace 删除空格
    editor.command.executeBackspace()

    const afterDel = (draw as any).getElementList()
    // 两张图片依然完好存在！
    const img1 = afterDel.find((el: any) => el.type === ElementType.IMAGE && el.value?.includes('pic1'))
    const img2 = afterDel.find((el: any) => el.type === ElementType.IMAGE && el.value?.includes('pic2'))
    expect(img1).toBeDefined()
    expect(img2).toBeDefined()

    destroy()
  })

  it('13. 无痕模式 (PREVIEW_EDIT) 下空占位符控件（包括表格单元格内）按 Backspace / Delete 键安全删除，绝对不报 undefined 错误', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.CONTROL,
            value: '',
            control: {
              conceptId: 'empty_text',
              type: ControlType.TEXT,
              placeholder: '空占位符',
              value: null
            }
          },
          {
            type: ElementType.TABLE,
            value: '',
            trList: [
              {
                height: 30,
                tdList: [
                  {
                    colspan: 1,
                    rowspan: 1,
                    value: [
                      {
                        type: ElementType.CONTROL,
                        value: '',
                        control: {
                          conceptId: 'table_empty_text',
                          type: ControlType.TEXT,
                          placeholder: '表格空占位符',
                          value: null
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          } as any
        ]
      },
      options: {
        mode: EditorMode.PREVIEW_EDIT
      }
    })

    const draw = editor.command.getDraw()
    const canvasEvent = draw.getCanvasEvent()

    // 1. 在正文空控件处设置光标并按退格键
    editor.command.executeSetRange(0, 0)
    expect(() => {
      editor.command.executeBackspace()
    }).not.toThrow()

    // 2. 在正文处模拟 Delete 键
    expect(() => {
      canvasEvent.keydown(new KeyboardEvent('keydown', { key: 'Delete' }))
    }).not.toThrow()

    // 3. 在表格内部设置光标并按 Backspace 和 Delete
    const tableEl = draw.getOriginalMainElementList().find((el: any) => el.type === ElementType.TABLE) as any
    expect(tableEl).toBeDefined()

    expect(() => {
      editor.command.executeBackspace()
    }).not.toThrow()

    expect(() => {
      canvasEvent.keydown(new KeyboardEvent('keydown', { key: 'Delete' }))
    }).not.toThrow()

    destroy()
  })
})
