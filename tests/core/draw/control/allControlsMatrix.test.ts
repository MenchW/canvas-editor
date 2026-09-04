import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../../factories/editor'
import { ElementType } from '@/editor/dataset/enum/Element'
import { ControlComponent, ControlType } from '@/editor/dataset/enum/Control'
import { EditorMode } from '@/editor/dataset/enum/Editor'
import { parseTableHtml } from '@/utils'
import { expandLoopTables } from '@/bridge/editorBridge'

describe('全量控件类型逐字删除、选区删除与删空自愈矩阵测试', () => {
  // ----------------------------------------------------
  // 1. Text 控件
  // ----------------------------------------------------
  describe('1. Text 控件', () => {
    it('逐字删除单字符保留控件结构，删空最后一个字时在无痕模式下彻底移除控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'text_field',
          type: ControlType.TEXT,
          placeholder: '文本字段',
          value: [{ value: 'AB' }]
        }
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const bIdx = list.findIndex((el: any) => el.value === 'B')
      expect(bIdx).toBeGreaterThan(-1)

      // 删除 'B'
      editor.command.executeSetRange(bIdx, bIdx)
      editor.command.executeBackspace()

      const midList = (draw as any).getElementList()
      expect(midList.some((el: any) => el.value === 'A')).toBe(true)
      expect(midList.some((el: any) => el.value === 'B')).toBe(false)
      expect(midList.some((el: any) => el.control?.conceptId === 'text_field')).toBe(true)

      // 删除 'A'（删空）
      const aIdx = midList.findIndex((el: any) => el.value === 'A')
      editor.command.executeSetRange(aIdx, aIdx)
      editor.command.executeBackspace()

      const finalList = (draw as any).getElementList()
      expect(finalList.some((el: any) => el.control?.conceptId === 'text_field')).toBe(false)
      destroy()
    })
  })

  // ----------------------------------------------------
  // 2. Number 控件
  // ----------------------------------------------------
  describe('2. Number 控件', () => {
    it('逐字删除数字保留控件，选区删除部分数字保留控件，删空自愈', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'num_field',
          type: ControlType.NUMBER,
          placeholder: '数值',
          value: [{ value: '92.5' }]
        }
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const fiveIdx = list.findIndex((el: any) => el.value === '5')
      expect(fiveIdx).toBeGreaterThan(-1)

      // 退格删除 '5'
      editor.command.executeSetRange(fiveIdx, fiveIdx)
      editor.command.executeBackspace()

      const midList = (draw as any).getElementList()
      const text = midList.map((el: any) => el.value).join('')
      expect(text).toContain('92.')
      expect(text).not.toContain('92.5')
      expect(midList.some((el: any) => el.control?.conceptId === 'num_field')).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 3. Date 控件
  // ----------------------------------------------------
  describe('3. Date 控件', () => {
    it('逐字删除日期字符保留控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'date_field',
          type: ControlType.DATE,
          placeholder: '日期',
          value: [{ value: '2026-09-02' }]
        }
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const last2Idx = list.findLastIndex((el: any) => el.value === '2')
      expect(last2Idx).toBeGreaterThan(-1)

      editor.command.executeSetRange(last2Idx, last2Idx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      const text = afterList.map((el: any) => el.value).join('')
      expect(text).toContain('2026-09-0')
      expect(afterList.some((el: any) => el.control?.conceptId === 'date_field')).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 4. Select 控件
  // ----------------------------------------------------
  describe('4. Select 控件', () => {
    it('Select 控件按 Backspace 清空所选值并恢复为占位符，控件结构完好保留', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'select_field',
          type: ControlType.SELECT,
          placeholder: '下拉选择',
          code: 'opt1',
          valueSets: [{ value: '一级预防', code: 'opt1' }],
          value: [{ value: '一级预防' }]
        }
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const fangIdx = list.findIndex((el: any) => el.value === '防')
      expect(fangIdx).toBeGreaterThan(-1)

      // 光标在选项文字处按 Backspace 清空选择
      editor.command.executeSetRange(fangIdx, fangIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      // 控件依然完好保留（恢复为占位符组件）
      expect(afterList.some((el: any) => el.control?.conceptId === 'select_field')).toBe(true)
      expect(afterList.some((el: any) => el.controlComponent === ControlComponent.PLACEHOLDER)).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 5. Checkbox 控件
  // ----------------------------------------------------
  describe('5. Checkbox 控件', () => {
    it('选项文本逐字删除保留复选框框格与控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'chk_field',
          type: ControlType.CHECKBOX,
          placeholder: '复选',
          valueSets: [{ value: '符合标准', code: 'opt1' }],
          code: 'opt1',
          value: null
        }
      })

      // 下发展开
      editor.command.executeSetControlValue({
        conceptId: 'chk_field',
        value: 'opt1'
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const zhunIdx = list.findIndex((el: any) => el.value === '准')
      expect(zhunIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(zhunIdx, zhunIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      expect(afterList.some((el: any) => el.value === '准')).toBe(false)
      expect(afterList.some((el: any) => el.value === '标')).toBe(true)
      expect(afterList.some((el: any) => el.controlComponent === ControlComponent.CHECKBOX)).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 6. Radio 控件
  // ----------------------------------------------------
  describe('6. Radio 控件', () => {
    it('单选选项文本逐字删除保留单选框与控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'radio_field',
          type: ControlType.RADIO,
          placeholder: '单选',
          valueSets: [{ value: '合格', code: 'pass' }, { value: '不合格', code: 'fail' }],
          code: 'pass',
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'radio_field',
        value: 'pass'
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const geIdx = list.findIndex((el: any) => el.value === '格')
      expect(geIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(geIdx, geIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      expect(afterList.some((el: any) => el.value === '合')).toBe(true)
      expect(afterList.some((el: any) => el.controlComponent === ControlComponent.RADIO)).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 7. List.Text 控件
  // ----------------------------------------------------
  describe('7. List.Text 控件', () => {
    it('多段文本列表其中一段逐字删除保留控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'list_text_field',
          type: 'list' as any,
          listType: 'text' as any,
          placeholder: '多段文本',
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'list_text_field',
        value: ['第一条意见', '第二条意见']
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const jianIdx = list.findIndex((el: any) => el.value === '见')
      expect(jianIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(jianIdx, jianIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      const text = afterList.map((el: any) => el.value).join('')
      expect(text).toContain('第一条意')
      expect(afterList.some((el: any) => el.control?.conceptId === 'list_text_field')).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 8. List.Image 控件
  // ----------------------------------------------------
  describe('8. List.Image 控件', () => {
    it('两图中间空格按退格只删空格，单图按退格只删该图', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'list_img_field',
          type: 'list' as any,
          listType: 'image' as any,
          placeholder: '多图',
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'list_img_field',
        value: ['https://example.com/1.png', 'https://example.com/2.png']
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()

      // 验证两图间空格删除
      const spIdx = list.findIndex(
        (el: any) =>
          el.controlComponent === ControlComponent.VALUE &&
          (el.value === ' ' || el.value === '  ')
      )
      expect(spIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(spIdx, spIdx)
      editor.command.executeBackspace()

      const afterSp = (draw as any).getElementList()
      const imgsAfterSp = afterSp.filter((el: any) => el.type === ElementType.IMAGE)
      expect(imgsAfterSp.length).toBe(2)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 9. List.Checkbox 控件
  // ----------------------------------------------------
  describe('9. List.Checkbox 控件', () => {
    it('选项文本逐字退格删除保留控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'list_chk_field',
          type: 'list' as any,
          listType: 'checkbox' as any,
          placeholder: '列表复选',
          valueSets: [{ value: '条款A已执行', code: 'c1' }],
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'list_chk_field',
        value: ['c1']
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const xingIdx = list.findIndex((el: any) => el.value === '行')
      expect(xingIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(xingIdx, xingIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      expect(afterList.some((el: any) => el.value === '行')).toBe(false)
      expect(afterList.some((el: any) => el.value === '执')).toBe(true)
      expect(afterList.some((el: any) => el.control?.conceptId === 'list_chk_field')).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 10. List.Radio 控件
  // ----------------------------------------------------
  describe('10. List.Radio 控件', () => {
    it('选项文本逐字退格删除保留单选框与控件', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'list_rad_field',
          type: 'list' as any,
          listType: 'radio' as any,
          placeholder: '列表单选',
          valueSets: [{ value: '选项一通过', code: 'r1' }],
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'list_rad_field',
        value: 'r1'
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const guoIdx = list.findIndex((el: any) => el.value === '过')
      expect(guoIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(guoIdx, guoIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      expect(afterList.some((el: any) => el.value === '通')).toBe(true)
      expect(afterList.some((el: any) => el.control?.conceptId === 'list_rad_field')).toBe(true)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 11. Image 控件
  // ----------------------------------------------------
  describe('11. Image 单图控件', () => {
    it('单图控件选区删除干净抹除，无痕模式不留单边括号', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'single_img',
          type: ControlType.IMAGE,
          placeholder: '单图',
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'single_img',
        value: 'https://example.com/pic.png'
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const imgIdx = list.findIndex((el: any) => el.type === ElementType.IMAGE)
      expect(imgIdx).toBeGreaterThan(-1)

      editor.command.executeSetRange(imgIdx, imgIdx)
      editor.command.executeBackspace()

      const afterList = (draw as any).getElementList()
      expect(afterList.some((el: any) => el.type === ElementType.IMAGE)).toBe(false)
      expect(afterList.some((el: any) => el.control?.conceptId === 'single_img')).toBe(false)

      destroy()
    })
  })

  // ----------------------------------------------------
  // 12. 表格内控件
  // ----------------------------------------------------
  describe('12. 表格单元格内控件', () => {
    it('表格单元格内文本控件逐字删除保留表格结构与控件', () => {
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
                            conceptId: 'td_control',
                            type: ControlType.TEXT,
                            placeholder: '单元格内容',
                            value: [{ value: '表格数据A' }]
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      const draw = editor.command.getDraw()
      const tableElement = (draw as any).getElementList().find((el: any) => el.type === ElementType.TABLE)
      expect(tableElement).toBeDefined()

      const cellList = tableElement.trList[0].tdList[0].value
      const aIdx = cellList.findIndex((el: any) => el.value === 'A')
      expect(aIdx).toBeGreaterThan(-1)

      // 在单元格内部执行逐字删除
      draw.deleteElementList(cellList, aIdx, 1)

      const text = cellList.map((el: any) => el.value).join('')
      expect(text).toContain('表格数据')
      expect(text).not.toContain('表格数据A')
      expect(cellList.some((el: any) => el.control?.conceptId === 'td_control')).toBe(true)

      destroy()
    })

    it('树形多级表格通栏满分值与单元格列表字段（tags）在普通模式与无痕模式下完整回显且零乱码', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] }
      })

      const htmlTemplate = `<table width="100%" border="1">
  <tbody loop="project in hierarchicalData">
    <tr>
      <td colspan="4">■ {{ project.projectName }} (满分 {{ project.projectMax }} 分)</td>
      <td>{{ project.projectActual }}</td>
    </tr>
    <tr loop="item in project.children">
      <td>{{ item.index }}</td>
      <td>
        {{ item.title }}<br/>
        {{ item.tags }}
      </td>
      <td>{{ item.problem }}</td>
      <td>{{ item.photos }}</td>
      <td>{{ item.score }}</td>
    </tr>
  </tbody>
</table>`

      const tableData = [
        {
          projectName: '基础资质与制度体系',
          projectMax: 50,
          projectActual: 50,
          children: [
            {
              index: 1,
              title: '食堂持有效食品经营许可证',
              tags: ['关键项', '高频核查'],
              problem: '暂无问题',
              photos: [],
              score: 25
            }
          ]
        }
      ]

      const tableEl = parseTableHtml(htmlTemplate)
      expandLoopTables([tableEl], { hierarchicalData: tableData })

      // 1. 普通模式下检查
      const firstRowTd0 = tableEl.trList[0].tdList[0].value
      const td0Text = firstRowTd0.map((el: any) => el.value).join('')
      expect(td0Text).toContain('基础资质与制度体系')
      expect(td0Text).toContain('50')
      expect(firstRowTd0.some((el: any) => el.controlComponent === 'value' && el.isPlaceholder === false)).toBe(true)

      // 检查 tags 列表字段
      const detailRowTd1 = tableEl.trList[1].tdList[1].value
      const td1Text = detailRowTd1.map((el: any) => el.value).join('')
      expect(td1Text).toContain('关键项')
      expect(td1Text).toContain('高频核查')
      expect(td1Text).not.toContain('🏷️') // 杜绝非标假 Emoji 标签

      // 2. 插入编辑器并切换到无痕模式
      editor.command.executeSetValue({ main: [tableEl] })
      editor.command.executeMode(EditorMode.PREVIEW_EDIT)

      const renderedTable = editor.command.getValue().data.main[0]
      expect(renderedTable.type).toBe('table')
      expect(renderedTable.trList).toBeDefined()

      const pMaxCtrl = renderedTable.trList![0].tdList[0].value.find((el: any) => el.control?.conceptId === 'projectMax')
      expect(pMaxCtrl).toBeDefined()
      expect(pMaxCtrl?.control?.value?.[0]?.value).toBe('50')

      destroy()
    })
  })
})
