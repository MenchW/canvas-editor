import { describe, it, expect } from 'vitest'
import { parseTableHtml } from '../../../src/utils'
import { applyDeclaredSameMerge, getTdText } from '../../../src/editor/utils/dataEngine'
import { ElementType } from '../../../src/editor/dataset/enum/Element'
import { zipElementList } from '../../../src/editor/utils/element'
import { expandLoopTables } from '../../../src/bridge/editorBridge'

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

  it('应正确解析单元格内部 div/span 的 loop 属性，并在数据回显时展开为多行且保留字段值', () => {
    const html = `<table width="100%" border="1">
      <tbody>
        <tr>
          <td>标化分</td>
          <td>{{ standardizedScore }} 分</td>
        </tr>
        <tr>
          <td>风险级别</td>
          <td>
            <div loop="item in riskRuleList">
              {{item.riskLevelName}}：{{ item.desc }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()
    const riskTd = tableEl.trList[1].tdList[1]

    // 验证 td.value 中包含 innerLoop 标记
    const loopNodes = riskTd.value.filter((el: any) => el.innerLoop?.isLoop)
    expect(loopNodes.length).toBeGreaterThan(0)
    expect(loopNodes[0].innerLoop.datasetId).toBe('riskRuleList')
    expect(loopNodes[0].innerLoop.itemAlias).toBe('item')

    // 验证控件的 conceptId 已正确剥离别名
    const controlNode = riskTd.value.find((el: any) => el.type === 'control')
    expect(controlNode).toBeDefined()
    expect(controlNode.control.conceptId).toBe('riskLevelName')
  })

  it('表格多次回显时应严格保证幂等性，不破坏原始模板与数据结构', () => {
    const html = `<table border="1">
      <tr loop="item in records">
        <td>{{ item.name }}</td>
      </tr>
    </table>`
    const tableEl = parseTableHtml(html)
    expect(tableEl.trList.length).toBe(1)
    expect(tableEl.trList[0].loopConfig).toBeDefined()
  })

  it('用户原始 HTML 模板解析及序列化后应完整保留 innerLoop 元数据', () => {
    const html = `<table width="100%" cellpadding="0" cellspacing="0" border="1">
  <tbody>
    <tr>
      <td width="20%" align="center">标化分</td>
      <td width="80%" align="center">{{ standardizedScore }} 分</td>
    </tr>
    <tr>
      <td align="center">风险级别</td>
      <td>
        <div loop="rule in riskRuleList">
          <input type="checkbox" />{{ rule.riskLevelName}}：{{rule.desc}}
        </div>
      </td>
    </tr>
    <tr>
      <td align="center">评估结果</td>
      <td align="center">经现场及资料评估，该单位食品安全工作存在{{ riskLevelText }} 。</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()
    const riskTd = tableEl.trList[1].tdList[1]

    // 1. 验证 HTML 解析出来的 td.value 节点包含 innerLoop
    const innerLoopNodes = riskTd.value.filter((el: any) => el.innerLoop?.isLoop)
    expect(innerLoopNodes.length).toBeGreaterThanOrEqual(4)
    expect(innerLoopNodes[0].innerLoop.datasetId).toBe('riskRuleList')
    expect(innerLoopNodes[0].innerLoop.itemAlias).toBe('rule')

    // 2. 验证 zipElementList 序列化后仍然保留 innerLoop
    const zipped = zipElementList([tableEl])
    const zippedTable = zipped[0] as any
    const zippedRiskTd = zippedTable.trList[1].tdList[1]
    const zippedLoopNodes = (zippedRiskTd.value || []).filter((el: any) => el.innerLoop?.isLoop)
    expect(zippedLoopNodes.length).toBeGreaterThanOrEqual(4)
    expect(zippedLoopNodes[0].innerLoop.datasetId).toBe('riskRuleList')
  })

  it('应正确解析并在数据回显时展开带 when 条件的 tbody loop 混合层级表格', () => {
    const html = `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th width="8%" align="center">序号</th>
      <th width="20%" align="center">评估内容</th>
      <th width="19%" align="center">问题描述</th>
      <th width="25%" align="center">现场照片</th>
      <th width="18%" align="center">整改建议</th>
      <th width="10%" align="center">得分</th>
    </tr>
  </thead>
  <tbody loop="item in flatMixedData">
    <tr when="item.level === 1">
      <td colspan="5" align="left"><b>■ {{ item.projectItemName }} （满分 {{ item.projectScore }} 分）</b></td>
      <td align="center">{{ item.projectActualScore }}</td>
    </tr>
    <tr when="item.level === 2">
      <td colspan="5" align="left"><b>{{ item.contentItemName }} （满分 {{ item.contentScore }} 分）</b></td>
      <td align="center">{{ item.contentActualScore }}</td>
    </tr>
    <tr when="item.level === 3">
      <td align="center">{{ item.itemIndex }}</td>
      <td>{{ item.evalContent }} （{{ item.baseScore }}分）</td>
      <td>{{ item.problemDesc }}</td>
      <td align="center">{{ item.images }}</td>
      <td>{{ item.rectifySuggest }}</td>
      <td align="center">{{ item.score }}</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()
    // 表头 1 行 + tbody 模板 3 行 = 4 行
    expect(tableEl.trList.length).toBe(4)
    // 验证第 1 行（即 tbody 的第 0 个 tr）带有 loopConfig 并且指定了 endTrIndex: 3
    const firstBodyTr = tableEl.trList[1]
    expect(firstBodyTr.loopConfig).toBeDefined()
    expect(firstBodyTr.loopConfig.datasetId).toBe('flatMixedData')
    expect(firstBodyTr.loopConfig.endTrIndex).toBe(3)
  })

  it('应正确支持多级表头复合分组表（一级大类 + 二级子类 + 三级明细），各组表头与明细按组交替渲染', () => {
    const html = `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th>序号</th>
      <th>评估内容</th>
      <th>问题描述</th>
      <th>现场照片</th>
      <th>整改建议</th>
      <th>得分</th>
    </tr>
  </thead>
  <tbody loop="group in groupedData">
    <tr>
      <td colspan="5"><b>{{ group.projectItemName }} (满分 {{ group.projectScore }} 分)</b></td>
      <td><b>{{ group.projectActualScore }}</b></td>
    </tr>
    <tr>
      <td colspan="5"><b>{{ group.contentItemName }} (满分 {{ group.contentScore }} 分)</b></td>
      <td><b>{{ group.contentActualScore }}</b></td>
    </tr>
    <tr loop="item in group.children">
      <td>{{ item.itemIndex }}</td>
      <td>{{ item.evalContent }}</td>
      <td>{{ item.problemDesc }}</td>
      <td>{{ item.images }}</td>
      <td>{{ item.rectifySuggest }}</td>
      <td>{{ item.score }}</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()

    const mockData = {
      groupedData: [
        {
          projectItemName: '资质与制度体系（关键）',
          projectScore: 100,
          projectActualScore: 90,
          contentItemName: '许可管理（关键）',
          contentScore: 50,
          contentActualScore: 50,
          children: [
            { itemIndex: 1, evalContent: '食堂持有效许可证', problemDesc: '无', score: 10 },
            { itemIndex: 2, evalContent: '无涂改伪造', problemDesc: '无', score: 10 }
          ]
        },
        {
          projectItemName: '资质与制度体系（关键）',
          projectScore: 100,
          projectActualScore: 90,
          contentItemName: '信息公示（关键）',
          contentScore: 50,
          contentActualScore: 40,
          children: [
            { itemIndex: 3, evalContent: '就餐区公示', problemDesc: '无', score: 10 }
          ]
        }
      ]
    }

    const elementList = [tableEl]
    expandLoopTables(elementList, mockData)
    const expandedTable = elementList[0]
    // 总行数 = 表头 1 行 + (Group0: 2 表头 + 2 明细) + (Group1: 2 表头 + 1 明细) = 1 + 4 + 3 = 8 行
    expect(expandedTable.trList.length).toBe(8)

    // 第 1 行：表头
    // 第 2 行：Group0 一级表头
    expect(getTdText(expandedTable.trList[1].tdList[0])).toContain('资质与制度体系（关键）')
    // 第 3 行：Group0 二级表头
    expect(getTdText(expandedTable.trList[2].tdList[0])).toContain('许可管理（关键）')
    // 第 4 行：Group0 明细 1
    expect(getTdText(expandedTable.trList[3].tdList[0])).toContain('1')
    // 第 5 行：Group0 明细 2
    expect(getTdText(expandedTable.trList[4].tdList[0])).toContain('2')
    // 第 6 行：Group1 一级表头
    expect(getTdText(expandedTable.trList[5].tdList[0])).toContain('资质与制度体系（关键）')
    // 第 7 行：Group1 二级表头
    expect(getTdText(expandedTable.trList[6].tdList[0])).toContain('信息公示（关键）')
    // 第 8 行：Group1 明细 3
    expect(getTdText(expandedTable.trList[7].tdList[0])).toContain('3')
  })

  it('应正确支持三层树形嵌套循环（一级大类 -> 二级子类 -> 三级明细）', () => {
    const html = `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th>序号</th>
      <th>评估内容</th>
      <th>问题描述</th>
      <th>现场照片</th>
      <th>整改建议</th>
      <th>得分</th>
    </tr>
  </thead>
  <tbody loop="project in threeLevelNestedData">
    <!-- 一级大类表头行 -->
    <tr>
      <td colspan="5"><b>{{ project.projectItemName }} (满分 {{ project.projectScore }} 分)</b></td>
      <td><b>{{ project.projectActualScore }}</b></td>
    </tr>
    <!-- 二级子类表头行 -->
    <tr loop="content in project.children">
      <td colspan="5"><b>{{ content.contentItemName }} (满分 {{ content.contentScore }} 分)</b></td>
      <td><b>{{ content.contentActualScore }}</b></td>
    </tr>
    <!-- 三级明细行 -->
    <tr loop="item in content.children">
      <td>{{ item.itemIndex }}</td>
      <td>{{ item.evalContent }}</td>
      <td>{{ item.problemDesc }}</td>
      <td>{{ item.images }}</td>
      <td>{{ item.rectifySuggest }}</td>
      <td>{{ item.score }}</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()

    const mockData = {
      threeLevelNestedData: [
        {
          projectItemName: '资质与制度体系（关键）',
          projectScore: 100,
          projectActualScore: 90,
          children: [
            {
              contentItemName: '许可管理（关键）',
              contentScore: 50,
              contentActualScore: 50,
              children: [
                { itemIndex: 1, evalContent: '持有效许可证', problemDesc: '无', score: 10 },
                { itemIndex: 5, evalContent: '实施准入退出机制', problemDesc: '无', score: 10 }
              ]
            },
            {
              contentItemName: '信息公示（关键）',
              contentScore: 50,
              contentActualScore: 40,
              children: [
                { itemIndex: 10, evalContent: '公示添加剂品种', problemDesc: '无', score: 0 }
              ]
            }
          ]
        },
        {
          projectItemName: '加工制作过程（合理）',
          projectScore: 100,
          projectActualScore: 100,
          children: [
            {
              contentItemName: '初加工（合理）',
              contentScore: 50,
              contentActualScore: 50,
              children: [
                { itemIndex: 11, evalContent: '分开设置荤素初加工', problemDesc: '无', score: 10 }
              ]
            }
          ]
        }
      ]
    }

    const elementList = [tableEl]
    expandLoopTables(elementList, mockData)
    const expandedTable = elementList[0]

    // 预估行数：
    // 表头 1 行
    // Project 1: 一级表头 1 + Content 1 (二级表头 1 + 明细 2) + Content 2 (二级表头 1 + 明细 1) = 1 + 3 + 2 = 6 行
    // Project 2: 一级表头 1 + Content 1 (二级表头 1 + 明细 1) = 3 行
    // 总行数 = 1 + 6 + 3 = 10 行
    expect(expandedTable.trList.length).toBe(10)

    // 验证顺序
    // 行 1：表头
    // 行 2：Project 1 一级表头（资质与制度体系，满分 100）
    expect(getTdText(expandedTable.trList[1].tdList[0])).toContain('资质与制度体系（关键）')
    // 行 3：Project 1 -> Content 1 二级表头（许可管理，满分 50）
    expect(getTdText(expandedTable.trList[2].tdList[0])).toContain('许可管理（关键）')
    // 行 4：明细 1
    expect(getTdText(expandedTable.trList[3].tdList[0])).toContain('1')
    // 行 5：明细 5
    expect(getTdText(expandedTable.trList[4].tdList[0])).toContain('5')
    // 行 6：Project 1 -> Content 2 二级表头（信息公示，满分 50）
    expect(getTdText(expandedTable.trList[5].tdList[0])).toContain('信息公示（关键）')
    // 行 7：明细 10
    expect(getTdText(expandedTable.trList[6].tdList[0])).toContain('10')
    // 行 8：Project 2 一级表头（加工制作过程，满分 100）
    expect(getTdText(expandedTable.trList[7].tdList[0])).toContain('加工制作过程（合理）')
    // 行 9：Project 2 -> Content 1 二级表头（初加工，满分 50）
    expect(getTdText(expandedTable.trList[8].tdList[0])).toContain('初加工（合理）')
    // 行 10：明细 11
    expect(getTdText(expandedTable.trList[9].tdList[0])).toContain('11')
  })

  it('应正确渲染食安评分表（单行明细循环 + 表尾合计行）', () => {
    const html = `<table width="100%" cellpadding="0" cellspacing="0" border="1">
    <thead>
        <tr>
            <th width="16%" align="center">序号</th>
            <th width="44%" align="center">评审项目</th>
            <th width="20%" align="center">满分分值</th>
            <th width="20%" align="center">实际得分</th>
        </tr>
    </thead>
    <tbody>
        <tr loop="item in scoreSheet.items">
            <td align="center">{{ item.index }}</td>
            <td>{{ item.itemName }}</td>
            <td align="center">{{ item.maxScore }}</td>
            <td align="center">{{ item.actualScore }}</td>
        </tr>
        <tr>
            <td colspan="2" align="center">
                <b>合 计</b>
            </td>
            <td align="center">{{ scoreSheet.totalMax }}</td>
            <td align="center">{{ scoreSheet.totalActual }}</td>
        </tr>
    </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()

    const mockData = {
      scoreSheet: {
        items: [
          { index: 1, itemName: '基础资质与制度体系', maxScore: 5, actualScore: 5 },
          { index: 2, itemName: '场所环境卫生与设施设备', maxScore: 10, actualScore: 10 },
          { index: 3, itemName: '食材采购与溯源管理', maxScore: 10, actualScore: 10 }
        ],
        totalMax: 100,
        totalActual: 100
      }
    }

    const elementList = [tableEl]
    expandLoopTables(elementList, mockData)
    const expandedTable = elementList[0]

    // 表头 1 行 + 明细 3 行 + 表尾合计 1 行 = 5 行
    expect(expandedTable.trList.length).toBe(5)

    // 验证明细数据
    expect(getTdText(expandedTable.trList[1].tdList[0])).toContain('1')
    expect(getTdText(expandedTable.trList[1].tdList[1])).toContain('基础资质与制度体系')
    expect(getTdText(expandedTable.trList[1].tdList[2])).toContain('5')

    expect(getTdText(expandedTable.trList[2].tdList[0])).toContain('2')
    expect(getTdText(expandedTable.trList[2].tdList[1])).toContain('场所环境卫生与设施设备')

    expect(getTdText(expandedTable.trList[3].tdList[0])).toContain('3')

    // 验证表尾合计行
    expect(getTdText(expandedTable.trList[4].tdList[0])).toContain('合 计')
    expect(getTdText(expandedTable.trList[4].tdList[1])).toContain('100')
    expect(getTdText(expandedTable.trList[4].tdList[2])).toContain('100')
  })

  it('功能模板 1：全控件全能渲染表应正确解析并驱动文本/复选框/多图/合计行渲染', () => {
    const html = `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th>序号</th>
      <th>考核项目</th>
      <th>勾选状态</th>
      <th>现场照片</th>
      <th>得分</th>
    </tr>
  </thead>
  <tbody>
    <tr loop="item in allControlsData.items">
      <td>{{ item.index }}</td>
      <td>{{ item.itemName }}</td>
      <td><input type="checkbox" checked="{{ item.checked }}" /> {{ item.statusText }}</td>
      <td>{{ item.images }}</td>
      <td>{{ item.score }}</td>
    </tr>
    <tr>
      <td colspan="4">合 计</td>
      <td>{{ allControlsData.totalScore }}</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()

    const mockData = {
      allControlsData: {
        items: [
          { index: 1, itemName: '许可证完备', checked: true, statusText: '符合', images: ['http://img1.jpg'], score: 10 },
          { index: 2, itemName: '防鼠板完好', checked: false, statusText: '不符', images: [], score: 0 }
        ],
        totalScore: 10
      }
    }

    const elementList = [tableEl]
    expandLoopTables(elementList, mockData)
    const expandedTable = elementList[0]

    expect(expandedTable.trList.length).toBe(4) // 表头 1 + 明细 2 + 合计 1
    expect(getTdText(expandedTable.trList[1].tdList[0])).toContain('1')
    expect(getTdText(expandedTable.trList[1].tdList[1])).toContain('许可证完备')
    expect(getTdText(expandedTable.trList[3].tdList[0])).toContain('合 计')
    expect(getTdText(expandedTable.trList[3].tdList[1])).toContain('10')
  })

  it('功能模板 4：动态条件与分支过滤表 (when) 应精确按数据字段值控制行级过滤', () => {
    const html = `<table width="100%" border="1">
  <thead>
    <tr>
      <th>内容</th>
      <th>得分</th>
    </tr>
  </thead>
  <tbody loop="item in conditionalWhenData">
    <tr when="item.level === 1">
      <td><b>★ {{ item.title }}</b></td>
      <td>{{ item.score }}</td>
    </tr>
    <tr when="item.level === 2">
      <td>{{ item.title }}</td>
      <td>{{ item.score }}</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()

    const mockData = {
      conditionalWhenData: [
        { level: 1, title: '第一部分：基础资质', score: 50 },
        { level: 2, title: '细则 1：许可证有效', score: 25 },
        { level: 2, title: '细则 2：人员健康证', score: 25 },
        { level: 1, title: '第二部分：卫生管理', score: 50 }
      ]
    }

    const elementList = [tableEl]
    expandLoopTables(elementList, mockData)
    const expandedTable = elementList[0]

    // 表头 1 行 + 4 行数据 = 5 行
    expect(expandedTable.trList.length).toBe(5)
    expect(getTdText(expandedTable.trList[1].tdList[0])).toContain('第一部分：基础资质')
    expect(getTdText(expandedTable.trList[2].tdList[0])).toContain('细则 1：许可证有效')
    expect(getTdText(expandedTable.trList[3].tdList[0])).toContain('细则 2：人员健康证')
    expect(getTdText(expandedTable.trList[4].tdList[0])).toContain('第二部分：卫生管理')
  })

  it('极端边界：三层树形嵌套在子数组为空(null/[])时应优雅回显表头且不崩溃', () => {
    const html = `<table width="100%" border="1">
  <thead><tr><th>序号</th><th>内容</th></tr></thead>
  <tbody loop="p in treeData">
    <tr><td colspan="2"><b>{{ p.title }}</b></td></tr>
    <tr loop="c in p.children">
      <td>-</td><td>{{ c.subTitle }}</td>
    </tr>
  </tbody>
</table>`

    const tableEl = parseTableHtml(html)
    expect(tableEl).toBeDefined()

    // 传入空 children
    const mockData = {
      treeData: [
        { title: '项目 A (无子项)', children: [] },
        { title: '项目 B (null 子项)', children: null },
        { title: '项目 C (正常子项)', children: [{ subTitle: '明细 C1' }] }
      ]
    }

    const elementList = [tableEl]
    expect(() => expandLoopTables(elementList, mockData)).not.toThrow()
    const expandedTable = elementList[0]

    // 表头 1 + A 表头 1 + B 表头 1 + C 表头 1 + C 明细 1 = 5 行
    expect(expandedTable.trList.length).toBe(5)
    expect(getTdText(expandedTable.trList[1].tdList[0])).toContain('项目 A (无子项)')
    expect(getTdText(expandedTable.trList[2].tdList[0])).toContain('项目 B (null 子项)')
    expect(getTdText(expandedTable.trList[3].tdList[0])).toContain('项目 C (正常子项)')
    expect(getTdText(expandedTable.trList[4].tdList[1])).toContain('明细 C1')
  })
})

