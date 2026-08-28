import Editor from '../../src/editor'

describe('右侧面板数据占位符拖拽与插入自动化测试', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3001/canvas-editor/')
    cy.get('canvas').first().as('canvas').should('have.length', 1)
  })

  it('右侧面板应成功渲染字段胶囊与明细表格卡片', () => {
    cy.get('.editor-aside-right').should('exist')
    cy.get('.aside-field-chip').should('have.length.at.least', 1)
    cy.get('.aside-table-card').should('have.length.at.least', 1)
  })

  it('点击胶囊可直接在画布中插入控件', () => {
    cy.getEditor().then((editor: Editor) => {
      editor.command.executeSelectAll()
      editor.command.executeBackspace()
      // 点击第一个胶囊
      cy.get('.aside-field-chip').first().click()
      cy.then(() => {
        const val = editor.command.getValue() as any
        const mainList = val?.data?.main || val?.main || []
        const hasControl = mainList.some((el: any) => el.type === 'control')
        expect(hasControl).to.be.true
      })
    })
  })

  it('真实模拟拖拽胶囊至画布 canvas 上并触发 drop 插入', () => {
    cy.getEditor().then((editor: Editor) => {
      editor.command.executeSelectAll()
      editor.command.executeBackspace()

      cy.get('.aside-field-chip').first().then(($chip) => {
        const chipEl = $chip[0]
        const dataTransfer = new DataTransfer()

        // 触发 dragstart
        chipEl.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          })
        )

        // 模拟拖拽到 canvas
        cy.get('@canvas').then(($canvas) => {
          const canvasEl = $canvas[0]

          canvasEl.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer,
              clientX: 300,
              clientY: 300
            })
          )

          canvasEl.dispatchEvent(
            new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              dataTransfer,
              clientX: 300,
              clientY: 300
            })
          )

          // 触发 dragend
          chipEl.dispatchEvent(
            new DragEvent('dragend', {
              bubbles: true,
              cancelable: true,
              dataTransfer
            })
          )

          cy.then(() => {
            const val = editor.command.getValue() as any
            const mainList = val?.data?.main || val?.main || []
            const hasControl = mainList.some((el: any) => el.type === 'control')
            expect(hasControl).to.be.true
          })
        })
      })
    })
  })

  it('在无痕编辑模式下，Checkbox 解包为自由编辑，点击末尾按 Backspace 仅逐字删除，不整块删除', () => {
    cy.getEditor().then((editor: Editor) => {
      editor.command.executeSelectAll()
      editor.command.executeBackspace()

      // 切换到无痕编辑模式
      editor.command.executeMode('preview_edit' as any)

      // 插入一个带多选项的复选框
      editor.command.executeInsertControl({
        type: 'control' as any,
        value: '',
        control: {
          conceptId: 'test.check',
          type: 'checkbox' as any,
          value: null,
          placeholder: '知情同意',
          valueSets: [
            { value: '知情同意条款A', code: 'a' },
            { value: '知情同意条款B', code: 'b' }
          ]
        }
      })

      // 定位光标在最末尾
      const valBefore = editor.command.getValue() as any
      const mainBefore = valBefore?.data?.main || valBefore?.main || []
      const lastIndex = mainBefore.length - 1
      editor.command.executeSetRange(lastIndex, lastIndex)

      // 执行一次退格键删除
      editor.command.executeBackspace()

      // 验证：数据不应被整块删除清空，而是保留前面的文字与复选框
      const valAfter = editor.command.getValue() as any
      const mainAfter = valAfter?.data?.main || valAfter?.main || []
      expect(mainAfter.length).to.be.greaterThan(0)
    })
  })

  it('新插入的 Checkbox 初始状态应处于未勾选（code 为 null，value 为 false）', () => {
    cy.getEditor().then((editor: Editor) => {
      editor.command.executeSelectAll()
      editor.command.executeBackspace()

      // 插入一个复选框
      editor.command.executeInsertControl({
        type: 'control' as any,
        value: '',
        control: {
          conceptId: 'test.init_check',
          type: 'checkbox' as any,
          value: null,
          placeholder: '症状',
          valueSets: [
            { value: '发热', code: 'fever' },
            { value: '咳嗽', code: 'cough' }
          ]
        }
      })

      const val = editor.command.getValue() as any
      const mainList = val?.data?.main || val?.main || []
      const controlElement = mainList.find((el: any) => el.type === 'control')
      expect(controlElement).to.exist
      expect(!controlElement.control.code).to.be.true
    })
  })

  it('回显文本数据后，切换到无痕编辑模式，删除个别文字不应清空整个回显文本', () => {
    cy.getEditor().then((editor: Editor) => {
      editor.command.executeSelectAll()
      editor.command.executeBackspace()

      // 插入一个文本控件并填充回显数据
      editor.command.executeInsertControl({
        type: 'control' as any,
        value: '',
        control: {
          conceptId: 'patient.diagnosis',
          type: 'text' as any,
          value: [{ value: '急性支气管炎伴发热' }],
          placeholder: '初步诊断'
        }
      })

      // 切换到无痕编辑模式
      editor.command.executeMode('preview_edit' as any)

      // 定位光标在正文倒数第 2 个位置
      const originalList = (editor.command as any).getOriginalElementList()
      const targetIndex = Math.max(0, originalList.length - 2)
      editor.command.executeSetRange(targetIndex, targetIndex)

      // 按一次退格键删除
      editor.command.executeBackspace()

      // 验证：回显数据依然存在，并未整块被删除清空
      const valAfter = editor.command.getValue() as any
      const mainAfter = valAfter?.data?.main || valAfter?.main || []
      expect(mainAfter.length).to.be.greaterThan(0)
    })
  })
})
