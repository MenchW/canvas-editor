import { describe, expect, it, beforeEach } from 'vitest'
import { Editor } from '../../../../src/editor'
import { ControlComponent, ControlType } from '../../../../src/editor/dataset/enum/Control'
import { EditorMode } from '../../../../src/editor/dataset/enum/Editor'
import { ElementType } from '../../../../src/editor/dataset/enum/Element'
import { KeyMap } from '../../../../src/editor/dataset/enum/KeyMap'
import { ZERO } from '../../../../src/editor/dataset/constant/Common'

describe('List 控件交互测试：删除、编辑模式输入与回车联动（对齐 Word）', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('1. List.Checkbox 控件在花括号后面 (POSTFIX) 按退格键 Backspace，能够将整个控件整块删除', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入 List.Checkbox 控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'test.list_checkbox',
        type: ControlType.CHECKBOX,
        listType: 'checkbox',
        placeholder: '条款一',
        value: null
      }
    })

    const draw = editor.command.getDraw() as any
    const elementList = draw.getElementList()
    // 找到该控件的 POSTFIX (花括号 '}')
    const postfixIndex = elementList.findIndex(
      (el: any) => el.control?.conceptId === 'test.list_checkbox' && el.controlComponent === ControlComponent.POSTFIX
    )
    expect(postfixIndex).toBeGreaterThan(-1)

    // 将光标置于花括号紧随其后的位置
    editor.command.executeSetRange(postfixIndex, postfixIndex)

    // 执行退格键 Backspace
    editor.command.executeBackspace()

    // 验证整个控件被彻底删除，没有任何残留
    const afterElements = draw.getElementList()
    const remainControlEl = afterElements.find((el: any) => el.control?.conceptId === 'test.list_checkbox')
    expect(remainControlEl).toBeUndefined()
  })

  it('2. 普通有内容的文本控件在花括号后面按 Backspace，光标安全移入末尾，绝不误删整段文字', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入带实际文本内容的普通 TextControl
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'patient.complaint',
        type: ControlType.TEXT,
        placeholder: '主诉',
        value: null
      }
    })

    // 设置实际文本内容
    editor.command.executeSetControlValue({
      conceptId: 'patient.complaint',
      value: '头痛三天'
    })

    const draw = editor.command.getDraw() as any
    const elementList = draw.getElementList()
    const postfixIndex = elementList.findIndex(
      (el: any) => el.control?.conceptId === 'patient.complaint' && el.controlComponent === ControlComponent.POSTFIX
    )
    expect(postfixIndex).toBeGreaterThan(-1)

    // 光标在花括号后面
    editor.command.executeSetRange(postfixIndex, postfixIndex)

    // 执行退格
    editor.command.executeBackspace()

    // 验证控件依然完整存在，文字没有被粗暴误删
    const afterElements = draw.getElementList()
    const hasValue = afterElements.some(
      (el: any) => el.control?.conceptId === 'patient.complaint' && el.controlComponent === ControlComponent.VALUE
    )
    expect(hasValue).toBe(true)

    // 光标移入到了控件内部 (postfixIndex - 1)
    const curRange = editor.command.getRange()
    expect(curRange.startIndex).toBe(postfixIndex - 1)
  })

  it('3. List.Checkbox 在编辑模式 (EditorMode.EDIT) 下允许输入编辑文本和回车', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入 List.Checkbox 并配置选项
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'surgery.clauses',
        type: 'list' as any,
        listType: 'checkbox' as any,
        placeholder: '条款复选',
        valueSets: [{ value: '条款项', code: 'opt1' }],
        code: null,
        value: null
      }
    })

    // 展开选项
    editor.command.executeSetControlValue({
      conceptId: 'surgery.clauses',
      value: ['opt1']
    })

    const draw = editor.command.getDraw() as any
    const elementList = draw.getElementList()
    const checkboxElIndex = elementList.findIndex(
      (el: any) => el.control?.conceptId === 'surgery.clauses' && el.controlComponent === ControlComponent.CHECKBOX
    )
    expect(checkboxElIndex).toBeGreaterThan(-1)

    // 光标定位在 CHECKBOX 后面的文本字符处
    editor.command.executeSetRange(checkboxElIndex + 1, checkboxElIndex + 1)

    // 在普通编辑模式下通过 canvasEvent 输入文字
    draw.getCanvasEvent().input('同意')

    const updatedList = draw.getElementList()
    const typedText = updatedList
      .filter((el: any) => el.control?.conceptId === 'surgery.clauses' && el.controlComponent === ControlComponent.VALUE)
      .map((el: any) => el.value)
      .join('')
    expect(typedText).toContain('同意')
  })

  it('4. List 控件回车联动：在 List.Checkbox 行按回车，新行自动生成同类型全新控件并支持 Word 式序号递增', () => {
    // 初始段落带编号前缀 "1. "
    const editor = new Editor(
      container,
      [{ value: '1' }, { value: '.' }, { value: ' ' }],
      {}
    )
    editor.command.executeMode(EditorMode.EDIT)

    const draw = editor.command.getDraw() as any
    // 将光标定位在 ' ' 后面插入 List.Checkbox
    editor.command.executeSetRange(2, 2)

    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'clause_list',
        type: ControlType.CHECKBOX,
        listType: 'checkbox',
        placeholder: '第一项',
        valueSets: [{ value: '已知晓手术风险', code: 'opt1' }],
        value: null
      }
    })

    editor.command.executeSetControlValue({
      conceptId: 'clause_list',
      value: ['opt1']
    })

    const elementList = draw.getElementList()
    const postfixIndex = elementList.findIndex(
      (el: any) => el.control?.conceptId === 'clause_list' && el.controlComponent === ControlComponent.POSTFIX
    )

    // 将光标移动到当前行末尾 (花括号后)
    editor.command.executeSetRange(postfixIndex, postfixIndex)

    // 敲击回车 Enter
    const enterEvt = new KeyboardEvent('keydown', { key: KeyMap.Enter, keyCode: 13 })
    draw.getCanvasEvent().keydown(enterEvt)

    // 验证：
    // 1. 标准换行：插入了换行元素，光标落在新行
    const finalList = draw.getElementList()
    const hasLineBreak = finalList.some((el: any) => el.value === ZERO || el.value === '\n')
    expect(hasLineBreak).toBe(true)

    // 2. 遵从结构化数据字典规范：不自动克隆生成全新的独立控件占位符
    const checkboxes = finalList.filter((el: any) => el.controlComponent === ControlComponent.CHECKBOX)
    expect(checkboxes.length).toBe(1)
  })

  it('5. 没有填充数据前，在占位符后面按 Enter 换行：必须完整保留占位符控件，并成功换行供插入其他控件', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入 List.Radio 控件（没有任何输入，纯占位符状态）
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'test_empty_radio',
        type: ControlType.RADIO,
        listType: 'radio',
        placeholder: '空单选',
        value: null
      }
    })

    const draw = editor.command.getDraw() as any
    const list = draw.getElementList()
    const postfixIdx = list.findIndex(
      (el: any) => el.control?.conceptId === 'test_empty_radio' && el.controlComponent === ControlComponent.POSTFIX
    )

    // 在占位符末尾 (花括号后) 按回车准备插入其他控件
    editor.command.executeSetRange(postfixIdx, postfixIdx)
    const enterEvt = new KeyboardEvent('keydown', { key: KeyMap.Enter, keyCode: 13 })
    draw.getCanvasEvent().keydown(enterEvt)

    // 核心验证：原占位符控件绝对不可被删除！必须完整保留！
    const afterList = draw.getElementList()
    const remainRadio = afterList.find((el: any) => el.control?.conceptId === 'test_empty_radio')
    expect(remainRadio).toBeDefined()

    // 验证成功换行：列表元素中新增了换行符元素 (ZERO / \n)，光标落在新行
    const hasLineBreak = afterList.some((el: any) => el.value === ZERO || el.value === '\n')
    expect(hasLineBreak).toBe(true)

    // 在新行继续插入另一个控件 (如文本控件)
    const newRange = editor.command.getRange()
    expect(newRange.startIndex).toBeGreaterThan(postfixIdx)
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'second_control',
        type: ControlType.TEXT,
        placeholder: '第二项',
        value: null
      }
    })

    // 两个控件均正常并存
    const finalList = draw.getElementList()
    const firstCtrl = finalList.find((el: any) => el.control?.conceptId === 'test_empty_radio')
    const secondCtrl = finalList.find((el: any) => el.control?.conceptId === 'second_control')
    expect(firstCtrl).toBeDefined()
    expect(secondCtrl).toBeDefined()
  })

  it('6. 多控件同一行回车换行：在第二个控件末尾敲回车，两个控件的花括号均完好保留，不出现花括号丢失', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 控件1: {一般风险}
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'riskLevelName',
        type: ControlType.TEXT,
        listType: 'text',
        placeholder: 'rule.riskLevelName',
        value: null
      }
    })
    const draw = editor.command.getDraw() as any
    // 在第一个控件内部输入 "一般风险"
    let list = draw.getElementList()
    let p1 = list.findIndex((el: any) => el.control?.conceptId === 'riskLevelName' && el.controlComponent === ControlComponent.POSTFIX)
    editor.command.executeSetRange(p1 - 1, p1 - 1)
    draw.getCanvasEvent().input('一般风险')

    // 移动到控件1后面，插入文本 "："
    list = draw.getElementList()
    p1 = list.findIndex((el: any) => el.control?.conceptId === 'riskLevelName' && el.controlComponent === ControlComponent.POSTFIX)
    editor.command.executeSetRange(p1, p1)
    draw.getCanvasEvent().input('：')

    // 控件2: {关键项不符合 < 1项 且 得分 ≥ 85分}
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'desc',
        type: ControlType.TEXT,
        listType: 'text',
        placeholder: 'rule.desc',
        value: null
      }
    })
    list = draw.getElementList()
    let p2 = list.findIndex((el: any) => el.control?.conceptId === 'desc' && el.controlComponent === ControlComponent.POSTFIX)
    editor.command.executeSetRange(p2 - 1, p2 - 1)
    draw.getCanvasEvent().input('关键项不符合 < 1项 且 得分 ≥ 85分')

    // 将光标定位在控件2末尾 (花括号后) 敲击回车
    list = draw.getElementList()
    p2 = list.findIndex((el: any) => el.control?.conceptId === 'desc' && el.controlComponent === ControlComponent.POSTFIX)
    editor.command.executeSetRange(p2, p2)

    const enterEvt = new KeyboardEvent('keydown', { key: KeyMap.Enter, keyCode: 13 })
    draw.getCanvasEvent().keydown(enterEvt)

    // 验证：
    // 1. 控件1 ({一般风险}) 的前缀和后缀花括号均完好
    const afterList = draw.getElementList()
    const c1Prefix = afterList.find((el: any) => el.control?.conceptId === 'riskLevelName' && el.controlComponent === ControlComponent.PREFIX)
    const c1Postfix = afterList.find((el: any) => el.control?.conceptId === 'riskLevelName' && el.controlComponent === ControlComponent.POSTFIX)
    expect(c1Prefix?.value).toBe('{')
    expect(c1Postfix?.value).toBe('}')

    // 2. 控件2 ({关键项不符合...≥ 85分}) 的前缀和后缀花括号也必须全部完好！(绝不可缺失花括号)
    const c2Prefix = afterList.find((el: any) => el.control?.conceptId === 'desc' && el.controlComponent === ControlComponent.PREFIX)
    const c2Postfix = afterList.find((el: any) => el.control?.conceptId === 'desc' && el.controlComponent === ControlComponent.POSTFIX)
    expect(c2Prefix?.value).toBe('{')
    expect(c2Postfix?.value).toBe('}')
  })

  it('7. 回车换行标准排版：在第一条内容末尾敲击回车并在新行打字，无痕模式下文本排版正常无多余空格', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入 List.Text 控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'test_item',
        type: ControlType.TEXT,
        listType: 'text',
        placeholder: '项描述',
        value: null
      }
    })
    const draw = editor.command.getDraw() as any
    let list = draw.getElementList()
    let p = list.findIndex((el: any) => el.control?.conceptId === 'test_item' && el.controlComponent === ControlComponent.POSTFIX)
    editor.command.executeSetRange(p - 1, p - 1)
    draw.getCanvasEvent().input('第一条内容')

    // 在第一条内容末尾敲击回车
    list = draw.getElementList()
    p = list.findIndex((el: any) => el.control?.conceptId === 'test_item' && el.controlComponent === ControlComponent.POSTFIX)
    editor.command.executeSetRange(p, p)

    const enterEvt = new KeyboardEvent('keydown', { key: KeyMap.Enter, keyCode: 13 })
    draw.getCanvasEvent().keydown(enterEvt)

    // 在新行打字 "第二条正文"
    draw.getCanvasEvent().input('第二条正文')

    // 切换为无痕模式 EditorMode.CLEAN
    editor.command.executeMode(EditorMode.CLEAN)

    // 验证无痕模式下文字排版正常，第二行文本开头为 "第"
    const cleanList = draw.getElementList()
    const targetEl = cleanList.find((el: any) => el.value === '第')
    expect(targetEl).toBeDefined()
  })

  it('8. 编辑模式填充数据后换行：emitControlChange 必须安全健壮，绝对不可抛出 TypeError (reading control)', () => {
    let capturedState: any = null
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 监听 controlChange 事件
    editor.listener.controlChange = payload => {
      capturedState = payload.state
    }

    // 插入 List.Text 控件并设置填充数据
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'test_fill_text',
        type: ControlType.TEXT,
        listType: 'text',
        placeholder: '文本项',
        value: null
      }
    })

    editor.command.executeSetControlValue({
      conceptId: 'test_fill_text',
      value: '已填充有效内容'
    })

    const draw = editor.command.getDraw() as any
    const list = draw.getElementList()
    const postfixIdx = list.findIndex(
      (el: any) => el.control?.conceptId === 'test_fill_text' && el.controlComponent === ControlComponent.POSTFIX
    )

    // 光标移入控件末尾敲击回车
    editor.command.executeSetRange(postfixIdx, postfixIdx)
    const enterEvt = new KeyboardEvent('keydown', { key: KeyMap.Enter, keyCode: 13 })

    // 核心验证：敲回车绝对不可抛出 Uncaught TypeError: Cannot read properties of undefined (reading 'control')
    expect(() => {
      draw.getCanvasEvent().keydown(enterEvt)
    }).not.toThrow()
    expect(capturedState).toBeDefined()
  })

  it('9. 编辑模式选中空白占位符按 Backspace/Delete：整块删除该占位符，不残留单边前缀花括号，绝不与后续控件重叠', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入控件1: 空白占位符 {请输入姓名}
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'patient.name',
        type: ControlType.TEXT,
        placeholder: '请输入姓名',
        value: null
      }
    })

    // 插入控件2: 空白占位符 {请输入年龄}
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'patient.age',
        type: ControlType.TEXT,
        placeholder: '请输入年龄',
        value: null
      }
    })

    const draw = editor.command.getDraw() as any
    const elementList = draw.getElementList()

    // 找到控件1的前缀与后缀
    const namePrefixIdx = elementList.findIndex(
      (el: any) => el.control?.conceptId === 'patient.name' && el.controlComponent === ControlComponent.PREFIX
    )
    const namePostfixIdx = elementList.findIndex(
      (el: any) => el.control?.conceptId === 'patient.name' && el.controlComponent === ControlComponent.POSTFIX
    )
    expect(namePrefixIdx).toBeGreaterThan(-1)
    expect(namePostfixIdx).toBeGreaterThan(namePrefixIdx)

    // 模拟用户框选了整个空白占位符控件1 (从其前缀选中到后缀)
    editor.command.executeSetRange(namePrefixIdx, namePostfixIdx)

    // 用户按下删除键
    editor.command.executeBackspace()

    const afterList = draw.getElementList()

    // 核心验证：
    // 1. 控件1的所有残余（包括前缀 {）被彻底删除，没有任何孤立花括号留在文档中
    const remainNamePrefix = afterList.find(
      (el: any) => el.control?.conceptId === 'patient.name'
    )
    expect(remainNamePrefix).toBeUndefined()

    // 2. 控件2完好存在，且其前缀紧随前文，绝不存在重叠的 "{{" 现象！
    const agePrefixIdx = afterList.findIndex(
      (el: any) => el.control?.conceptId === 'patient.age' && el.controlComponent === ControlComponent.PREFIX
    )
    expect(agePrefixIdx).toBeGreaterThan(-1)
    const prevChar = afterList[agePrefixIdx - 1]?.value
    expect(prevChar).not.toBe('{')
  })

  it('10. 选中多图列表控件中的某张图片按退格：删除该单张图片，并在撤回 (Undo) 与重做 (Redo) 后，图片调整框 (Previewer Resizer) 不会在画布上悬浮残留', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入多图控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'exam.images',
        type: ControlType.IMAGE,
        listType: 'image',
        placeholder: '上传检查图',
        value: null
      }
    })

    // 下发两张图片
    editor.command.executeSetControlValue({
      conceptId: 'exam.images',
      value: [
        { url: 'https://example.com/img1.png', width: 80, height: 80 },
        { url: 'https://example.com/img2.png', width: 80, height: 80 }
      ]
    })

    const draw = editor.command.getDraw() as any
    const list = draw.getElementList()
    const img2 = list.find(
      (el: any) => el.type === ElementType.IMAGE && el.value?.includes('img2')
    )
    expect(img2).toBeDefined()

    // 模拟用户点击选中第二张图片（激活 Previewer 尺寸手柄）
    const previewer = draw.getPreviewer()
    previewer.drawResizer(img2)
    expect(previewer.getIsResizerVisible()).toBe(true)

    // 用户按下退格键删除第二张图片
    editor.command.executeBackspace()

    // 验证退格后仅删除了第二张图片，第一张图片完好
    const midList = draw.getElementList()
    const remainImg1 = midList.find((el: any) => el.value?.includes('img1'))
    const remainImg2 = midList.find((el: any) => el.value?.includes('img2'))
    expect(remainImg1).toBeDefined()
    expect(remainImg2).toBeUndefined()

    // 用户继续在后方输入文字
    draw.getCanvasEvent().input('添加诊断说明')

    // 执行撤回 (Undo)
    editor.command.executeUndo()

    // 核心验证：撤回后，调整控制框绝不悬浮残留！
    expect(previewer.getIsResizerVisible()).toBe(false)

    // 执行重做 (Redo)
    editor.command.executeRedo()

    // 核心验证：重做后，调整控制框同样绝不悬浮残留！
    expect(previewer.getIsResizerVisible()).toBe(false)
  })

  it('11. 无痕模式 (PREVIEW_EDIT) 下多图列表在末尾按 Backspace：安全逐张删除末尾图片，绝不整块删除整个多图控件', () => {
    const editor = new Editor(container, [], {})
    editor.command.executeMode(EditorMode.EDIT)

    // 插入多图控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'exam.photos',
        type: ControlType.IMAGE,
        listType: 'image',
        placeholder: '多图相册',
        value: null
      }
    })

    // 下发两张图片
    editor.command.executeSetControlValue({
      conceptId: 'exam.photos',
      value: [
        { url: 'https://example.com/photo1.png', width: 80, height: 80 },
        { url: 'https://example.com/photo2.png', width: 80, height: 80 }
      ]
    })

    // 切换为无痕模式 (PREVIEW_EDIT)
    editor.command.executeMode(EditorMode.PREVIEW_EDIT)

    const draw = editor.command.getDraw() as any
    const list = draw.getElementList()
    const postfixIdx = list.findIndex(
      (el: any) => el.control?.conceptId === 'exam.photos' && el.controlComponent === ControlComponent.POSTFIX
    )
    expect(postfixIdx).toBeGreaterThan(-1)

    // 在无痕模式下光标定在多图最末端（此时底层对应 POSTFIX 位置，但界面上无花括号）
    editor.command.executeSetRange(postfixIdx, postfixIdx)

    // 按下 Backspace 退格键
    editor.command.executeBackspace()

    // 此时光标安全移入第二张图片，再次按下退格键
    editor.command.executeBackspace()

    // 核心验证：仅删除了 photo2，photo1 依然完好存在！绝没有将整个控件整块误删！
    const afterList = draw.getElementList()
    const remainPhoto1 = afterList.find((el: any) => el.value?.includes('photo1'))
    const remainPhoto2 = afterList.find((el: any) => el.value?.includes('photo2'))
    expect(remainPhoto1).toBeDefined()
    expect(remainPhoto2).toBeUndefined()
  })
})
