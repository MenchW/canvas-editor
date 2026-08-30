/**
 * 共享 Mock 数据源与 Provider 逻辑
 */
;(function (global) {
  // 默认组件字典预设 (作为没有后端/缓存时的 Mock 数据源)
  const DEFAULT_COMPONENT_DATA = [
    {
      groupName: '就诊与诊断基础信息',
      systemName: 'HIS电子病历系统',
      description: '患者基本登记信息、门诊知情条款与临床诊断列表',
      children: [
        {
          conceptId: 'patient.name',
          name: '患者姓名',
          type: 'text',
          description: '就诊患者真实姓名'
        },
        {
          conceptId: 'patient.age',
          name: '患者年龄',
          type: 'text',
          description: '就诊时实际年龄'
        },
        {
          conceptId: 'patient.dept',
          name: '就诊科室',
          type: 'text',
          description: '接诊科室名称'
        },
        {
          conceptId: 'patient.gender',
          name: '患者性别 (List.Radio)',
          type: 'list',
          listType: 'radio',
          layout: 'horizontal',
          description: '单选选项组，宿主下发选项数组并驱动互斥勾选'
        },
        {
          conceptId: 'diagnose.diagnosis_items',
          name: '临床诊断列表 (List.Text)',
          type: 'list',
          listType: 'text',
          layout: 'vertical',
          description: '多行分段列表，宿主下发 [{label, code}] 自动格式化多行'
        },
        {
          conceptId: 'surgery.consent_clauses',
          name: '知情同意条款 (List.Checkbox)',
          type: 'list',
          listType: 'checkbox',
          layout: 'vertical',
          description: '多段复选框列表，宿主下发条款选项并驱动多项勾选'
        },
        {
          conceptId: 'exam.report_images',
          name: '检查影像多图 (List.Image)',
          type: 'list',
          listType: 'image',
          layout: 'grid',
          gridCols: 3,
          description: '影像报告多图集合，自适应网格排列渲染'
        }
      ]
    },
    {
      groupName: '医疗质控评分考核表',
      systemName: 'EMR质控系统',
      description:
        '医疗质量考核打分：含固定表头、明细动态循环行及表尾合并合计行',
      children: [
        {
          conceptId: 'score_sheet',
          name: '评分汇总表 (含表尾合并合计行)',
          type: 'table',
          pagingRepeat: false,
          description: '前置表头 + 动态明细循环 + 表尾合并合计行 (colspan=2)',
          htmlTemplate: `<table border="1">
  <!-- 1. 表头行 -->
  <tr>
    <th>序号</th>
    <th>评审项目</th>
    <th>满分分值</th>
    <th>实际得分</th>
  </tr>

  <!-- 2. 动态明细循环行 (loop 声明循环源) -->
  <tr loop="item in score_sheet.items">
    <td>{{ item.index }}</td>
    <td>{{ item.item_name }}</td>
    <td>{{ item.max_score }}</td>
    <td>{{ item.actual_score }}</td>
  </tr>

  <!-- 3. 表尾固定合计行 (colspan=2 合并 + 汇总字段) -->
  <tr>
    <td colspan="2" align="center"><b>合 计</b></td>
    <td>{{ score_sheet.total_max }}</td>
    <td>{{ score_sheet.total_actual }}</td>
  </tr>
</table>`
        }
      ]
    },
    {
      groupName: 'LIS常规检验明细表',
      systemName: 'LIS检验系统',
      description:
        '检验科血液生化结果明细，支持根据首列相邻相同数据自动纵向合并(Rowspan)',
      children: [
        {
          conceptId: 'lis.adjacent_merge_table',
          name: 'LIS常规检验明细表 (合并同类项 merge-same)',
          type: 'table',
          pagingRepeat: false,
          description:
            '首列使用 merge-same 指令声明相同检验大类自动纵向合并，其余列正常循环',
          htmlTemplate: `<table border="1">
  <tr>
    <th>检验大类</th>
    <th>检测项目</th>
    <th>结果数值</th>
    <th>单位</th>
    <th>参考范围</th>
  </tr>
  <tr loop="item in lis.records">
    <!-- merge-same 声明此列遇到连续相同内容时自动纵向合并单元格 -->
    <td merge-same>{{ item.category_name }}</td>
    <td>{{ item.lab_item_name }}</td>
    <td>{{ item.lab_item_value }}</td>
    <td>{{ item.lab_item_unit }}</td>
    <td>{{ item.lab_item_ref }}</td>
  </tr>
</table>`
        }
      ]
    },
    {
      groupName: '大标题复合检验影像报告',
      systemName: 'LIS复合检验系统',
      description:
        '多级复合结构：外层循环大标题通栏合并(Colspan=4)，内层循环表格明细，单元格内嵌套多图',
      children: [
        {
          conceptId: 'composite.grouped_report',
          name: '大标题复合检验报告集 (通栏合并+多图)',
          type: 'table',
          pagingRepeat: false,
          description:
            '大标题通栏合并(Colspan=4)，内层指标明细，单元格嵌套多图',
          htmlTemplate: `<table border="1">
  <!-- 1. 固定表头行 -->
  <thead>
    <tr>
      <th>检测项目</th>
      <th>结果数值</th>
      <th>参考范围</th>
      <th>化验报告影像 (多图)</th>
    </tr>
  </thead>

  <!-- 2. 外层循环大标题分组 (tbody 循环外层数组) -->
  <tbody loop="group in composite.grouped_report">
    <!-- 组内大标题通栏行 -->
    <tr>
      <td colspan="4" align="left" style="background:#F2F4F8;"><b>■ {{ group.title }}</b></td>
    </tr>

    <!-- 组内具体的明细循环行 (循环 group.children 数组) -->
    <tr loop="item in group.children">
      <td>{{ item.itemName }}</td>
      <td>{{ item.result }}</td>
      <td>{{ item.reference }}</td>
      <td>{{ item.imgList }}</td>
    </tr>
  </tbody>
</table>`
        }
      ]
    }
  ]

  // 组件字典 Provider：优先读取本地缓存，未设置时回退至 DEFAULT_COMPONENT_DATA 下发
  function mockFetchComponentListApi() {
    const savedDict = localStorage.getItem('CE_COMPONENT_DICTIONARY')
    if (savedDict) {
      try {
        const parsed = JSON.parse(savedDict)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Promise.resolve(parsed)
        }
      } catch (e) {
        console.warn('[mockFetchComponentListApi] 读取本地字典解析异常', e)
      }
    }
    return Promise.resolve(DEFAULT_COMPONENT_DATA)
  }

  // 模板数据 Provider (getTemplate)
  function mockFetchTemplateApi() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: {
            header: [],
            main: [
              // 1. 文档大标题
              {
                value: '',
                type: 'title',
                level: 'first',
                rowFlex: 'center',
                valueList: [
                  {
                    value: '结构化临床诊疗与检验综合报告单',
                    size: 20,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              // 2. 患者基础信息行
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  { value: '一、患者登记信息', size: 15, bold: true }
                ]
              },
              { value: '\n' },
              { value: '患者姓名：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.name',
                  type: 'text',
                  placeholder: '姓名',
                  value: []
                }
              },
              { value: '性别 (Radio单选)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.gender',
                  type: 'radio',
                  value: null,
                  code: '0',
                  flexDirection: 'row',
                  valueSets: [
                    { value: '男', code: '1' },
                    { value: '女', code: '2' },
                    { value: '未知', code: '0' }
                  ]
                }
              },
              { value: '    年龄：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.age',
                  type: 'text',
                  placeholder: '年龄',
                  value: []
                }
              },
              { value: '    患者照片：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.avatar',
                  type: 'image',
                  placeholder: '头像',
                  width: 48,
                  height: 48,
                  value: []
                }
              },
              { value: '\n\n' },
              // 3. 场景一：分段式序号动态列表
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '二、门诊诊断结论 (场景一：分段序号列表)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'diagnose.diagnosis_items',
                  type: 'list',
                  listType: 'text',
                  layout: 'vertical',
                  placeholder:
                    '点击上方填充数据按钮将自动回显为分段序号列表...',
                  value: []
                }
              },
              { value: '\n\n' },
              // 4. 场景三：多段以 Checkbox 开始的长文本条款列表
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '三、知情同意与条款声明 (场景三：多段Checkbox)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'surgery.consent_clauses',
                  type: 'checkbox',
                  value: null,
                  code: null,
                  flexDirection: 'column',
                  valueSets: [
                    {
                      value:
                        '患者及家属已知悉本次诊疗方案、操作流程及相关并发症风险。',
                      code: 'clause_1'
                    },
                    {
                      value:
                        '术前已按临床规范完成血常规、凝血功能及传染病八项筛查。',
                      code: 'clause_2'
                    },
                    {
                      value:
                        '经详细病史核实无已知麻醉药物严重过敏史及绝对手术禁忌症。',
                      code: 'clause_3'
                    }
                  ]
                }
              },
              { value: '\n\n' },
              // 4. 场景四：相邻相同数据动态纵向合并表格 (Rowspan)
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value:
                      '四、LIS临床检验结果 (场景四：相邻相同自动合并表格)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              {
                type: 'table',
                value: '',
                conceptId: 'lis.adjacent_merge_table',
                trList: [
                  {
                    height: 32,
                    tdList: [
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '检验分类', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '检测项目', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '结果数值', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '单位', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '参考区间', bold: true }]
                      }
                    ]
                  },
                  {
                    height: 36,
                    tdList: [
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [{ value: '生化常规检查' }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [{ value: '谷丙转氨酶 (ALT)' }]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '-' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: 'U/L' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '0-40' }] }
                    ]
                  }
                ]
              },
              { value: '\n\n' },
              // 6. 场景五：带跨列大标题通栏 + 明细循环 + 单元格嵌套多图复合表
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value:
                      '五、多组复合检验报告 (场景五：大标题通栏+嵌套多图)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              {
                type: 'table',
                value: '',
                conceptId: 'composite.grouped_report',
                trList: [
                  {
                    height: 32,
                    tdList: [
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '检测项目', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '结果数值', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [{ value: '参考范围', bold: true }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#FAFAFA',
                        value: [
                          { value: '化验报告影像 (多图)', bold: true }
                        ]
                      }
                    ]
                  },
                  {
                    height: 32,
                    tdList: [
                      {
                        colspan: 4,
                        rowspan: 1,
                        backgroundColor: '#F2F4F8',
                        value: [
                          {
                            value: '■ 一、血常规检查组 (WBC/RBC/PLT)',
                            bold: true,
                            size: 13
                          }
                        ]
                      }
                    ]
                  },
                  {
                    height: 44,
                    tdList: [
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [{ value: '白细胞计数 (WBC)' }]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '-' }] },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [{ value: '4.0-10.0' }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [
                          {
                            type: 'control',
                            value: '',
                            control: {
                              conceptId: 'imgList[].url',
                              type: 'image',
                              placeholder: '[影像多图]',
                              width: 42,
                              height: 42,
                              value: []
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              { value: '\n' }
            ],
            footer: []
          },
          options: {
            margins: [80, 100, 80, 100],
            pageNumber: {
              format: '第{pageNo}页/共{pageCount}页'
            }
          }
        })
      }, 0)
    })
  }

  // 业务数据 Provider (getData / 回显数据)
  function mockFetchBusinessDataApi() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          patient: {
            gender: [
              { label: '男', value: '1', checked: false },
              { label: '女', value: '2', checked: true },
              { label: '未知', value: '0', checked: false }
            ],
            age: '',
            avatar:
              'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440'
          },
          patient_gender: '2',
          patient_age: '35岁',
          patient_avatar:
            'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
          score_sheet: {
            total_max: 250,
            total_actual: 238,
            items: [
              {
                index: 1,
                item_name: '入院记录书写时效性与完整度',
                max_score: 50,
                actual_score: 48
              },
              {
                index: 2,
                item_name: '病程记录及主治医师查房意见',
                max_score: 50,
                actual_score: 47
              },
              {
                index: 3,
                item_name: '术前讨论与知情同意签署规范',
                max_score: 50,
                actual_score: 49
              },
              {
                index: 4,
                item_name: '辅助检查及化验结果分析合理性',
                max_score: 50,
                actual_score: 46
              },
              {
                index: 5,
                item_name: '出院小结及随访用药指导方案',
                max_score: 50,
                actual_score: 48
              }
            ]
          },
          diagnose: {
            diagnosis_items: [
              {
                label: '1. 高血压3级（极高危，收缩压≥180mmHg）',
                code: 'item_1'
              },
              {
                label:
                  '2. 冠状动脉粥样硬化性心脏病（劳力性心绞痛，CCS II级）',
                code: 'item_2'
              },
              {
                label: '3. 2型糖尿病（伴周围神经病变与微量白蛋白尿）',
                code: 'item_3'
              },
              {
                label: '4. 高脂血症（混合型高胆固醇与甘油三酯血症）',
                code: 'item_4'
              }
            ]
          },
          surgery: {
            consent_clauses: [
              {
                label:
                  '1. 患者及家属已知悉本次诊疗方案、操作流程及相关并发症风险。',
                value: 'clause_1',
                checked: true
              },
              {
                label:
                  '2. 术前已按临床规范完成血常规、凝血功能及传染病八项筛查。',
                value: 'clause_2',
                checked: false
              },
              {
                label:
                  '3. 经详细病史核实无已知麻醉药物严重过敏史及绝对手术禁忌症。',
                value: 'clause_3',
                checked: true
              }
            ]
          },
          exam: {
            report_images: [
              'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
              'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
              'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440'
            ]
          },
          lis: {
            records: [
              {
                category_name: '生化常规检查',
                lab_item_name: '谷丙转氨酶 (ALT)',
                lab_item_value: 25,
                lab_item_unit: 'U/L',
                lab_item_ref: '0-40'
              },
              {
                category_name: '生化常规检查',
                lab_item_name: '谷草转氨酶 (AST)',
                lab_item_value: 19,
                lab_item_unit: 'U/L',
                lab_item_ref: '0-40'
              },
              {
                category_name: '生化常规检查',
                lab_item_name: '总胆红素 (TBIL)',
                lab_item_value: 12.4,
                lab_item_unit: 'μmol/L',
                lab_item_ref: '3.4-17.1'
              },
              {
                category_name: '生化常规检查',
                lab_item_name: '直接胆红素 (DBIL)',
                lab_item_value: 4.1,
                lab_item_unit: 'μmol/L',
                lab_item_ref: '0-6.8'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '总胆固醇 (TC)',
                lab_item_value: 4.2,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '<5.18'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '甘油三酯 (TG)',
                lab_item_value: 1.5,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '<1.70'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '高密度脂蛋白 (HDL-C)',
                lab_item_value: 1.25,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '>1.04'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '低密度脂蛋白 (LDL-C)',
                lab_item_value: 2.38,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '<3.37'
              }
            ],
            adjacent_merge_table: [
              {
                category_name: '生化常规检查',
                lab_item_name: '谷丙转氨酶 (ALT)',
                lab_item_value: 25,
                lab_item_unit: 'U/L',
                lab_item_ref: '0-40'
              },
              {
                category_name: '生化常规检查',
                lab_item_name: '谷草转氨酶 (AST)',
                lab_item_value: 19,
                lab_item_unit: 'U/L',
                lab_item_ref: '0-40'
              },
              {
                category_name: '生化常规检查',
                lab_item_name: '总胆红素 (TBIL)',
                lab_item_value: 12.4,
                lab_item_unit: 'μmol/L',
                lab_item_ref: '3.4-17.1'
              },
              {
                category_name: '生化常规检查',
                lab_item_name: '直接胆红素 (DBIL)',
                lab_item_value: 4.1,
                lab_item_unit: 'μmol/L',
                lab_item_ref: '0-6.8'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '总胆固醇 (TC)',
                lab_item_value: 4.2,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '<5.18'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '甘油三酯 (TG)',
                lab_item_value: 1.5,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '<1.70'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '高密度脂蛋白 (HDL-C)',
                lab_item_value: 1.25,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '>1.04'
              },
              {
                category_name: '血脂四项指标',
                lab_item_name: '低密度脂蛋白 (LDL-C)',
                lab_item_value: 2.38,
                lab_item_unit: 'mmol/L',
                lab_item_ref: '<3.37'
              }
            ]
          },
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
                  },
                  {
                    itemName: '血红蛋白浓度 (HGB)',
                    result: '142',
                    reference: '120-160',
                    imgList: []
                  },
                  {
                    itemName: '血小板计数 (PLT)',
                    result: '210',
                    reference: '100-300',
                    imgList: [
                      {
                        url: 'https://gips2.baidu.com/it/u=1958261546,408422616&fm=3028&app=3028&f=JPEG?w=1024&h=1024'
                      }
                    ]
                  }
                ]
              },
              {
                title: '二、尿液常规与沉渣镜检分析组',
                children: [
                  {
                    itemName: '尿蛋白定性 (PRO)',
                    result: '阳性 (+)',
                    reference: '阴性 (-)',
                    imgList: [
                      {
                        url: 'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440'
                      }
                    ]
                  },
                  {
                    itemName: '尿潜血 (BLD)',
                    result: '阴性 (-)',
                    reference: '阴性 (-)',
                    imgList: []
                  },
                  {
                    itemName: '尿白细胞镜检 (WBC-HP)',
                    result: '2-4 /HP',
                    reference: '0-5 /HP',
                    imgList: []
                  }
                ]
              },
              {
                title: '三、肝肾代谢与离子生化组',
                children: [
                  {
                    itemName: '血清肌酐 (Cr)',
                    result: '88.5',
                    reference: '53-106',
                    imgList: []
                  },
                  {
                    itemName: '尿素氮 (BUN)',
                    result: '6.2',
                    reference: '3.2-7.1',
                    imgList: []
                  },
                  {
                    itemName: '血清钾 (K+)',
                    result: '4.15',
                    reference: '3.5-5.3',
                    imgList: []
                  }
                ]
              }
            ]
          }
        })
      }, 0)
    })
  }

  // 挂载到全局
  global.DEFAULT_COMPONENT_DATA = DEFAULT_COMPONENT_DATA
  global.mockFetchComponentListApi = mockFetchComponentListApi
  global.mockFetchTemplateApi = mockFetchTemplateApi
  global.mockFetchBusinessDataApi = mockFetchBusinessDataApi
})(typeof window !== 'undefined' ? window : this)
