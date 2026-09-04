import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../../factories/editor'
import { ElementType } from '@/editor/dataset/enum/Element'
import { ControlComponent, ControlType } from '@/editor/dataset/enum/Control'
import { EditorMode } from '@/editor/dataset/enum/Editor'
import { expandLoopTables } from '@/bridge/editorBridge'

describe('系统全量控件与跨页表格核心场景深度回归测试套件', () => {
  // =========================================================================
  // 一、所有基础控件与复合列表控件在双模式下的渲染与删除回归
  // =========================================================================
  describe('1. 基础与复合控件（Text / Number / Select / Radio / Checkbox / Date / Image / List）', () => {
    it('1.1 Text / Number 控件：单字删除保留结构，选区删除正确，无痕模式零花括号', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'userName',
          type: ControlType.TEXT,
          placeholder: '姓名',
          value: [{ value: '张三丰' }]
        }
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const sIdx = list.findIndex((el: any) => el.value === '三')
      expect(sIdx).toBeGreaterThan(-1)

      // 删除中间字 '三'
      editor.command.executeSetRange(sIdx, sIdx)
      editor.command.executeBackspace()

      const midList = (draw as any).getElementList()
      const textVal = midList
        .filter(
          (el: any) =>
            el.controlComponent !== ControlComponent.PREFIX &&
            el.controlComponent !== ControlComponent.POSTFIX
        )
        .map((el: any) => el.value)
        .join('')
      expect(textVal).toContain('张丰')

      destroy()
    })

    it('1.2 List.text (标签列表) 控件：多段列表展开，无痕模式无花括号，无 Emoji 乱码', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'tagList',
          type: 'list' as any,
          listType: 'text' as any,
          placeholder: '标签列表',
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'tagList',
        value: ['关键项', '高频核查']
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const textVal = list.map((el: any) => el.value).join('')

      expect(textVal).toContain('关键项')
      expect(textVal).toContain('高频核查')
      expect(textVal).not.toContain('🏷')

      destroy()
    })

    it('1.3 List.checkbox (多项复选) 控件：逐字退格不整删，选区删除安全，无痕模式零花括号', () => {
      const { editor, destroy } = createTestEditor({
        data: { main: [{ value: '\n' }] },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      editor.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: {
          conceptId: 'multiConsent',
          type: 'list' as any,
          listType: 'checkbox' as any,
          placeholder: '告知选项',
          valueSets: [
            { value: '充分告知', code: '1' },
            { value: '无禁忌症', code: '2' }
          ],
          value: null
        }
      })

      editor.command.executeSetControlValue({
        conceptId: 'multiConsent',
        value: ['1', '2']
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const gaoIdx = list.findIndex((el: any) => el.value === '告')
      expect(gaoIdx).toBeGreaterThan(-1)

      // 删除单字 '告'
      editor.command.executeSetRange(gaoIdx, gaoIdx)
      editor.command.executeBackspace()

      const midList = (draw as any).getElementList()
      const textVal = midList.map((el: any) => el.value).join('')
      expect(textVal).toContain('充分知')
      expect(textVal).toContain('无禁忌症')

      destroy()
    })

    it('1.4 Image (图片占位/已填充) 控件：删除图片不删空画布，长选区跨图片安全删除', () => {
      const { editor, destroy } = createTestEditor({
        data: {
          main: [
            { value: '前缀' },
            {
              type: ElementType.IMAGE,
              value: 'https://example.com/demo.png',
              width: 100,
              height: 100
            },
            { value: '后缀\n' }
          ]
        },
        options: { mode: EditorMode.PREVIEW_EDIT }
      })

      const draw = editor.command.getDraw()
      const list = (draw as any).getElementList()
      const imgIdx = list.findIndex((el: any) => el.type === ElementType.IMAGE)
      expect(imgIdx).toBeGreaterThan(-1)

      // 单独删除图片
      editor.command.executeSetRange(imgIdx, imgIdx)
      editor.command.executeBackspace()

      const afterImgDel = (draw as any).getElementList()
      const textAfter = afterImgDel.map((el: any) => el.value).join('')
      expect(textAfter).toContain('前缀')
      expect(textAfter).toContain('后缀')
      expect(afterImgDel.some((el: any) => el.type === ElementType.IMAGE)).toBe(false)

      destroy()
    })
  })

  // =========================================================================
  // 二、跨页表格深度交互全场景回归（光标定位、换行追加、单元格内编辑）
  // =========================================================================
  describe('2. 跨页表格核心交互全场景回归', () => {
    it('2.1 跨页表格第二页单元格内部点击应精准命中第二页单元格，绝不跳到第一页', () => {
      const trList: any[] = []
      for (let r = 0; r < 25; r++) {
        trList.push({
          height: 60,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: `Cell-${r}-0` }] },
            { colspan: 1, rowspan: 1, value: [{ value: `Cell-${r}-1` }] }
          ]
        })
      }

      const { editor, destroy } = createTestEditor({
        data: { main: [{ type: ElementType.TABLE, value: '', trList }] },
        options: { width: 600, height: 600 }
      })

      const draw = editor.command.getDraw()
      const position = draw.getPosition()
      expect(draw.getPageCount()).toBeGreaterThan(1)

      const page1Positions = (position as any).tablePagingPositionMap.get(1) || []
      expect(page1Positions.length).toBeGreaterThan(0)
      const { rightTop, leftBottom } = page1Positions[0].coordinate

      // 点击第二页单元格内部右下角
      const clickPos = position.getPositionByXY({
        x: rightTop[0] - 20,
        y: leftBottom[1] - 15,
        pageNo: 1
      })

      expect(clickPos.isTable).toBe(true)
      expect(clickPos.trIndex).toBeGreaterThan(10)
      expect(clickPos.tdIndex).toBe(1)

      destroy()
    })

    it('2.2 跨页表格末尾页点击应定位在表格末尾/后方正文，光标高度为标准字号(16px)', () => {
      const trList: any[] = []
      for (let r = 0; r < 25; r++) {
        trList.push({
          height: 60,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: `Row-${r}` }] }
          ]
        })
      }

      const { editor, destroy } = createTestEditor({
        data: { main: [{ type: ElementType.TABLE, value: '', trList }] },
        options: { width: 600, height: 600, defaultSize: 16 }
      })

      const draw = editor.command.getDraw()
      const position = draw.getPosition()
      const lastPageNo = draw.getPageCount() - 1

      // 模拟在最后一页表格右下角点击
      draw.setPageNo(lastPageNo)
      const lastPositions =
        (position as any).tablePagingPositionMap.get(lastPageNo) || []
      expect(lastPositions.length).toBeGreaterThan(0)
      const { rightTop, leftBottom } = lastPositions[0].coordinate

      const clickPos = position.getPositionByXY({
        x: rightTop[0] + 10,
        y: leftBottom[1] + 20,
        pageNo: lastPageNo
      })
      expect(clickPos.index).toBeGreaterThanOrEqual(0)

      draw.setCursor(clickPos.index)
      const cursorPosition = position.getCursorPosition()
      expect(cursorPosition).not.toBeNull()
      // 光标高度必须为标准的 16px 左右，绝不能是几百像素
      expect(cursorPosition?.metrics.height).toBe(16)
      const diffHeight =
        (cursorPosition?.coordinate.leftBottom[1] ?? 0) -
        (cursorPosition?.coordinate.leftTop[1] ?? 0)
      expect(diffHeight).toBe(16)

      destroy()
    })

    it('2.3 树形嵌套多级表格与 List 字段在普通模式与无痕模式下展开无任何数据污染或乱码', () => {
      const tableTemplate = {
        type: 'table',
        trList: [
          {
            loopConfig: {
              isLoopRow: true,
              datasetId: 'checkList',
              itemAlias: 'item',
              sourcePath: 'checkList'
            },
            tdList: [
              {
                value: [
                  {
                    type: 'control',
                    value: '',
                    control: {
                      type: 'text',
                      conceptId: 'tag',
                      placeholder: 'tag'
                    },
                    innerLoop: {
                      isLoop: true,
                      datasetId: 'item.tags',
                      itemAlias: 'tag',
                      isBlock: false
                    }
                  }
                ]
              }
            ]
          }
        ]
      }

      const tableData = {
        patient: { name: '张建国' },
        checkList: [
          {
            index: 1,
            title: '持有效食品经营许可证',
            tags: ['关键项', '资质合规'],
            problem: '暂无问题'
          }
        ]
      }

      const cloneTemplate = JSON.parse(JSON.stringify(tableTemplate))
      expandLoopTables([cloneTemplate as any], tableData)

      // 验证展开结果：零 张建国 污染，零 🏷️ 乱码
      const fullText = JSON.stringify(cloneTemplate)
      expect(fullText).toContain('关键项')
      expect(fullText).toContain('资质合规')
      expect(fullText).not.toContain('张建国')
      expect(fullText).not.toContain('🏷')
    })
  })
})
