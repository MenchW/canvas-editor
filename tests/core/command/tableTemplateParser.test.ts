import { describe, it, expect } from 'vitest'
import { parseTableHtml } from '../../../src/utils'
import { applyDeclaredSameMerge, getTdText } from '../../../src/editor/utils/dataEngine'
import { ElementType } from '../../../src/editor/dataset/enum/Element'

describe('Table Template Parser & Declared Same Merge (Double Braces)', () => {
  it('应严格解析双花括号占位符 {{ item.fieldKey }}', () => {
    const html = `<table border="1">
      <tr>
        <th>序号</th>
        <th>项目名称</th>
      </tr>
      <tr loop="item in score_sheet.items">
        <td>{{ item.index }}</td>
        <td>{{ item.item_name }}</td>
      </tr>
    </table>`

    const tableEl = parseTableHtml(html, { defaultConceptId: 'score_sheet' })
    expect(tableEl).toBeDefined()
    expect(tableEl.trList.length).toBe(2)

    // 检查第二行循环行的单元格控件
    const dataTr = tableEl.trList[1]
    const td0 = dataTr.tdList[0]
    const td1 = dataTr.tdList[1]

    expect(td0.value[0].type).toBe(ElementType.CONTROL)
    expect(td0.value[0].control?.conceptId).toBe('index')

    expect(td1.value[0].type).toBe(ElementType.CONTROL)
    expect(td1.value[0].control?.conceptId).toBe('item_name')
  })

  it('指令 merge-same 应正确合并相邻相同数据，且未声明列绝对不错位', () => {
    const html = `<table border="1">
      <tr>
        <th>检验大类</th>
        <th>检测项目</th>
        <th>结果数值</th>
        <th>单位</th>
        <th>参考范围</th>
      </tr>
      <tr loop="item in lis.records">
        <td merge-same>{{ item.category_name }}</td>
        <td>{{ item.lab_item_name }}</td>
        <td>{{ item.lab_item_value }}</td>
        <td>{{ item.lab_item_unit }}</td>
        <td>{{ item.lab_item_ref }}</td>
      </tr>
    </table>`

    const tableEl = parseTableHtml(html, { defaultConceptId: 'lis' })
    // 首列应带有 mergeSame: 'vertical'
    expect(tableEl.trList[1].tdList[0].mergeSame).toBe('vertical')

    // 模拟回显展开为 8 行明细数据（4 行生化常规检查 + 4 行血脂四项指标）
    const headerRow = tableEl.trList[0]

    const mockData = [
      { category_name: '生化常规检查', lab_item_name: 'ALT', lab_item_value: '25', lab_item_unit: 'U/L', lab_item_ref: '0-40' },
      { category_name: '生化常规检查', lab_item_name: 'AST', lab_item_value: '19', lab_item_unit: 'U/L', lab_item_ref: '0-40' },
      { category_name: '生化常规检查', lab_item_name: 'TBIL', lab_item_value: '12.4', lab_item_unit: 'μmol/L', lab_item_ref: '3.4-17.1' },
      { category_name: '生化常规检查', lab_item_name: 'DBIL', lab_item_value: '4.1', lab_item_unit: 'μmol/L', lab_item_ref: '0-6.8' },
      { category_name: '血脂四项指标', lab_item_name: 'TC', lab_item_value: '4.2', lab_item_unit: 'mmol/L', lab_item_ref: '<5.18' },
      { category_name: '血脂四项指标', lab_item_name: 'TG', lab_item_value: '1.5', lab_item_unit: 'mmol/L', lab_item_ref: '<1.70' },
      { category_name: '血脂四项指标', lab_item_name: 'HDL-C', lab_item_value: '1.25', lab_item_unit: 'mmol/L', lab_item_ref: '>1.04' },
      { category_name: '血脂四项指标', lab_item_name: 'LDL-C', lab_item_value: '2.38', lab_item_unit: 'mmol/L', lab_item_ref: '<3.37' }
    ]

    const expandedTrList = [
      headerRow,
      ...mockData.map(item => ({
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, mergeSame: 'vertical' as const, value: [{ value: item.category_name }] },
          { colspan: 1, rowspan: 1, value: [{ value: item.lab_item_name }] },
          { colspan: 1, rowspan: 1, value: [{ value: item.lab_item_value }] },
          { colspan: 1, rowspan: 1, value: [{ value: item.lab_item_unit }] },
          { colspan: 1, rowspan: 1, value: [{ value: item.lab_item_ref }] }
        ]
      }))
    ]

    const fullTableEl = {
      ...tableEl,
      trList: expandedTrList
    }

    // 执行声明式相邻相同合并
    applyDeclaredSameMerge(fullTableEl)

    // 验证结果：
    // 1. 第 1 个数据行（索引 1）应拥有 rowspan: 4，内容为 "生化常规检查"
    const row1 = fullTableEl.trList[1]
    expect(row1.tdList[0].rowspan).toBe(4)
    expect(getTdText(row1.tdList[0])).toBe('生化常规检查')
    expect(row1.tdList.length).toBe(5) // 首行 5 个单元格完整

    // 2. 第 2、3、4 数据行（索引 2,3,4）首列已被移除，只剩下 4 个单元格
    for (let r = 2; r <= 4; r++) {
      const row = fullTableEl.trList[r]
      expect(row.tdList.length).toBe(4)
      // 验证第二列仍是检测项目，绝不错位
      expect(getTdText(row.tdList[0])).toBe(mockData[r - 1].lab_item_name)
      expect(getTdText(row.tdList[1])).toBe(mockData[r - 1].lab_item_value)
      expect(getTdText(row.tdList[2])).toBe(mockData[r - 1].lab_item_unit)
      expect(getTdText(row.tdList[3])).toBe(mockData[r - 1].lab_item_ref)
    }

    // 3. 第 5 个数据行（索引 5）应拥有 rowspan: 4，内容为 "血脂四项指标"
    const row5 = fullTableEl.trList[5]
    expect(row5.tdList[0].rowspan).toBe(4)
    expect(getTdText(row5.tdList[0])).toBe('血脂四项指标')
    expect(row5.tdList.length).toBe(5)

    // 4. 第 6、7、8 数据行（索引 6,7,8）首列已被移除，只剩下 4 个单元格且数据完美对齐
    for (let r = 6; r <= 8; r++) {
      const row = fullTableEl.trList[r]
      expect(row.tdList.length).toBe(4)
      expect(getTdText(row.tdList[0])).toBe(mockData[r - 1].lab_item_name)
      expect(getTdText(row.tdList[1])).toBe(mockData[r - 1].lab_item_value)
      expect(getTdText(row.tdList[2])).toBe(mockData[r - 1].lab_item_unit)
      expect(getTdText(row.tdList[3])).toBe(mockData[r - 1].lab_item_ref)
    }
  })

  it('复合分组表格 (tbody 大标题通栏 + 明细循环) 数据驱动回显时，每个分组的大标题与明细行必须交替配对展开，绝不扎堆', async () => {
    const { applyGenericDataEngine } = await import('../../../src/editor/utils/dataEngine')
    const html = `<table border="1">
      <thead>
        <tr>
          <th>检测项目与组合</th>
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
          <td>{{ item.itemName }} - {{ item.result }}</td>
          <td>{{ item.result }}</td>
          <td>{{ item.reference }}</td>
          <td>{{ item.imgList }}</td>
        </tr>
      </tbody>
    </table>`

    const tableEl = parseTableHtml(html, { defaultConceptId: 'composite.grouped_report' })
    expect(tableEl.trList.length).toBe(3) // 表头(0) + 大标题(1) + 明细模板(2)

    const mockBusinessData = {
      composite: {
        grouped_report: [
          {
            title: '一、血常规检查组 (WBC/RBC/PLT/HGB)',
            children: [
              { itemName: '白细胞计数 (WBC)', result: '6.5', reference: '3.5-9.5', imgList: [] },
              { itemName: '红细胞计数 (RBC)', result: '4.8', reference: '4.3-5.8', imgList: [] }
            ]
          },
          {
            title: '二、尿液常规与沉渣镜检分析组',
            children: [
              { itemName: '尿蛋白 (PRO)', result: '阴性 (-)', reference: '阴性', imgList: [] }
            ]
          }
        ]
      }
    }

    const editorPayload = [tableEl]
    applyGenericDataEngine(editorPayload, mockBusinessData)

    const renderedTrList = editorPayload[0].trList
    // 总行数 = 1 表头 + (1大标题 + 2明细) + (1大标题 + 1明细) = 6 行
    expect(renderedTrList.length).toBe(6)

    // 验证顺序：
    // 行 0：固定表头
    expect(getTdText(renderedTrList[0].tdList[0])).toBe('检测项目与组合')

    // 行 1：第 1 组大标题
    expect(getTdText(renderedTrList[1].tdList[0])).toContain('一、血常规检查组')

    // 行 2：第 1 组第 1 条明细
    expect(getTdText(renderedTrList[2].tdList[0])).toBe('白细胞计数 (WBC) - 6.5')
    expect(getTdText(renderedTrList[2].tdList[1])).toBe('6.5')

    // 行 3：第 1 组第 2 条明细
    expect(getTdText(renderedTrList[3].tdList[0])).toBe('红细胞计数 (RBC) - 4.8')
    expect(getTdText(renderedTrList[3].tdList[1])).toBe('4.8')

    // 行 4：第 2 组大标题（紧跟在第 1 组明细后面，绝不扎堆在最前面！）
    expect(getTdText(renderedTrList[4].tdList[0])).toContain('二、尿液常规与沉渣镜检分析组')

    // 行 5：第 2 组第 1 条明细
    expect(getTdText(renderedTrList[5].tdList[0])).toBe('尿蛋白 (PRO) - 阴性 (-)')
    expect(getTdText(renderedTrList[5].tdList[1])).toBe('阴性 (-)')
  })

  it('应正确解析单元格内部子节点（如 div/span）的 style 与 when 指令属性', () => {
    const html = `<table border="1">
      <tr loop="item in score_sheet.items">
        <td>{{ item.max_score }} <div when="item.max_score > 50" style="color:red">测试</div></td>
      </tr>
    </table>`

    const tableEl = parseTableHtml(html, { defaultConceptId: 'score_sheet' })
    const td = tableEl.trList[0].tdList[0]
    expect(td.value.length).toBeGreaterThanOrEqual(2)

    // 找到 "测试" 字符节点
    const testChar = td.value.find((el: any) => el.value === '测')
    expect(testChar).toBeDefined()
    expect(testChar.color).toBe('red')
    expect(testChar.when).toBe('item.max_score > 50')
  })
})

