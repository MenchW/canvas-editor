import {
  ControlType,
  ElementType,
  FlexDirection,
  IEditorOption,
  IElement,
  RowFlex,
  TitleLevel
} from './editor'

const elementList: IElement[] = []

// ==========================================
// 1. 文档大标题
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.FIRST,
    rowFlex: RowFlex.CENTER,
    valueList: [
      {
        value: '结构化全能诊疗与健康评估综合报告单',
        size: 20,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  }
)

// ==========================================
// 2. 模块一：患者登记与基础信息 (Text, Number, Radio, Select, Date, Image)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '一、患者就诊登记与基础信息 (全控件基础形态)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  // 行 1：姓名(Text) + 性别(Radio) + 年龄(Number) + 就诊类型(Select)
  { value: '患者姓名：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.name',
      type: ControlType.TEXT,
      placeholder: '请输入姓名',
      value: [{ value: '张建国' }]
    }
  },
  { value: '    性别 (Radio)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.gender',
      type: ControlType.RADIO,
      value: null,
      code: '1',
      flexDirection: FlexDirection.ROW,
      valueSets: [
        { value: '男', code: '1' },
        { value: '女', code: '2' },
        { value: '未知', code: '0' }
      ]
    }
  },
  { value: '    年龄 (Number)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.age',
      type: ControlType.NUMBER,
      placeholder: '年龄',
      value: [{ value: '45' }]
    }
  },
  { value: ' 岁    就诊类型 (Select)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.visit_type',
      type: ControlType.SELECT,
      placeholder: '请选择就诊类型',
      value: [{ value: '专家门诊' }],
      code: 'expert',
      valueSets: [
        { value: '普通门诊', code: 'normal' },
        { value: '专家门诊', code: 'expert' },
        { value: '急诊通道', code: 'emergency' },
        { value: '特需医疗', code: 'vip' }
      ]
    }
  },
  {
    value: '\n'
  },
  // 行 2：就诊科室(Text) + 门诊号(Text) + 就诊日期(Date) + 检查时间(Date)
  { value: '就诊科室：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.dept',
      type: ControlType.TEXT,
      placeholder: '接诊科室',
      value: [{ value: '心血管内科一病区' }]
    }
  },
  { value: '    门诊病历号：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.record_no',
      type: ControlType.TEXT,
      placeholder: '病历号',
      value: [{ value: 'EMR202609010088' }]
    }
  },
  { value: '    就诊日期 (Date)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.visit_date',
      type: ControlType.DATE,
      dateFormat: 'YYYY-MM-DD',
      placeholder: '选择日期',
      value: [{ value: '2026-09-01' }]
    }
  },
  {
    value: '\n'
  },
  // 行 3：患者免冠头像(Image) + 医生电子签名(Image)
  { value: '患者头像 (Image)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.avatar',
      type: ControlType.IMAGE,
      placeholder: '患者照片',
      width: 52,
      height: 52,
      value: [
        {
          type: ElementType.IMAGE,
          value: 'https://picsum.photos/120/120?random=101',
          width: 52,
          height: 52
        }
      ]
    }
  },
  { value: '       接诊医师签名章 (Image)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'doctor.signature',
      type: ControlType.IMAGE,
      placeholder: '医生签名',
      width: 90,
      height: 40,
      value: [
        {
          type: ElementType.IMAGE,
          value: 'https://picsum.photos/180/80?random=102',
          width: 90,
          height: 40
        }
      ]
    }
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 3. 模块二：生命体征与生理指标 (Number 数值型控件)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '二、生命体征与生理测量 (Number 测量数值组)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  { value: '体温 (T)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'vitals.temperature',
      type: ControlType.NUMBER,
      placeholder: '体温',
      value: [{ value: '36.6' }]
    }
  },
  { value: ' ℃    收缩压 (SBP)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'vitals.sbp',
      type: ControlType.NUMBER,
      placeholder: '高压',
      value: [{ value: '135' }]
    }
  },
  { value: ' mmHg    舒张压 (DBP)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'vitals.dbp',
      type: ControlType.NUMBER,
      placeholder: '低压',
      value: [{ value: '88' }]
    }
  },
  { value: ' mmHg    心率 (HR)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'vitals.heart_rate',
      type: ControlType.NUMBER,
      placeholder: '心率',
      value: [{ value: '78' }]
    }
  },
  { value: ' 次/分    体重：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'vitals.weight',
      type: ControlType.NUMBER,
      placeholder: '体重',
      value: [{ value: '68.5' }]
    }
  },
  { value: ' kg' },
  {
    value: '\n\n'
  }
)

// ==========================================
// 4. 模块三：病史采集与诊断列表 (Checkbox 复选组 + 多段文本列表)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '三、既往病史与临床诊断 (Checkbox复选 + 多段文本列表)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  { value: '既往既发疾病筛查 (Checkbox 多选)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.past_history',
      type: ControlType.CHECKBOX,
      value: null,
      code: 'hbp,dm', // 默认勾选高血压与糖尿病
      flexDirection: FlexDirection.ROW,
      valueSets: [
        { value: '原发性高血压', code: 'hbp' },
        { value: '2型糖尿病', code: 'dm' },
        { value: '冠状动脉粥样硬化', code: 'chd' },
        { value: '青霉素/磺胺过敏史', code: 'allergy' },
        { value: '慢性支气管炎', code: 'copd' }
      ]
    }
  },
  {
    value: '\n'
  },
  { value: '初步门诊诊断结论 (List.Text 分段条目)：', bold: true },
  {
    value: '\n'
  },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'diagnose.diagnosis_items',
      type: ControlType.TEXT,
      placeholder: '临床诊断条目列表',
      value: [
        { value: '1. ', bold: true },
        { value: '高血压2级（中危组，血压控制稳定）' },
        { value: '\n' },
        { value: '2. ', bold: true },
        { value: '2型糖尿病（伴轻度周围神经病变）' },
        { value: '\n' },
        { value: '3. ', bold: true },
        { value: '高脂血症（高甘油三酯血症，轻度）' }
      ]
    }
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 5. 模块四：知情同意与条款签署 (Checkbox 纵向排列)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '四、诊疗知情同意与风险告知 (Checkbox 纵向多段条款)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'surgery.consent_clauses',
      type: ControlType.CHECKBOX,
      value: null,
      code: 'clause_1,clause_2,clause_3',
      flexDirection: FlexDirection.COLUMN,
      valueSets: [
        {
          value: '患者及代理人已被充分告知治疗方案、预期疗效及可能伴随的不良反应。',
          code: 'clause_1'
        },
        {
          value: '核实无近期重大创伤手术史、活动性出血倾向及严重麻醉药物过敏史。',
          code: 'clause_2'
        },
        {
          value: '同意严格遵照医嘱按时规范用药，定期进行血糖、血压及肝肾功能随访复查。',
          code: 'clause_3'
        }
      ]
    }
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 6. 经典表格示例一：全控件全能渲染考核表 (单行明细循环 + 关键项 + 复选框 + 现场多图 + 表尾合计行)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '五、临床医疗质量与安全考核表 (经典示例 1：全控件+表尾合并合计行)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  {
    type: ElementType.TABLE,
    value: '',
    conceptId: 'feature_all_controls_table',
    trList: [
      // 1. 表头行
      {
        height: 32,
        tdList: [
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '序号', bold: true, rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '质控考核项目与规范', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '核查状态', bold: true, rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '现场影像佐证 (多图)', bold: true, rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '标准分', bold: true, rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '实得分', bold: true, rowFlex: RowFlex.CENTER }] }
        ]
      },
      // 2. 数据明细行 1
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '1', rowFlex: RowFlex.CENTER }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              { value: '[关键项] ', bold: true, color: '#1890FF' },
              { value: '严格落实首诊负责制与急危重症患者抢救制度' }
            ]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: '☑ 符合规范', color: '#52C41A', bold: true, rowFlex: RowFlex.CENTER }]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value: 'https://picsum.photos/120/80?random=11',
                width: 48,
                height: 36
              }
            ]
          },
          { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: RowFlex.CENTER, bold: true }] }
        ]
      },
      // 3. 数据明细行 2
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '2', rowFlex: RowFlex.CENTER }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              { value: '[核心项] ', bold: true, color: '#FAAD14' },
              { value: '三级查房记录在患者入院 24/48 小时内按时完成' }
            ]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: '☑ 符合规范', color: '#52C41A', bold: true, rowFlex: RowFlex.CENTER }]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: '无附件', color: '#999999', rowFlex: RowFlex.CENTER }]
          },
          { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: RowFlex.CENTER, bold: true }] }
        ]
      },
      // 4. 数据明细行 3
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '3', rowFlex: RowFlex.CENTER }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              { value: '[安全项] ', bold: true, color: '#FF4D4F' },
              { value: '处方与用药医嘱严格实行双人核对制度' }
            ]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: '☑ 符合规范', color: '#52C41A', bold: true, rowFlex: RowFlex.CENTER }]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value: 'https://picsum.photos/120/80?random=12',
                width: 48,
                height: 36
              }
            ]
          },
          { colspan: 1, rowspan: 1, value: [{ value: '40', rowFlex: RowFlex.CENTER }] },
          { colspan: 1, rowspan: 1, value: [{ value: '40', rowFlex: RowFlex.CENTER, bold: true }] }
        ]
      },
      // 5. 表尾跨列合计行 (colspan = 4)
      {
        height: 36,
        tdList: [
          {
            colspan: 4,
            rowspan: 1,
            backgroundColor: '#F5F5F5',
            value: [{ value: '考核汇总得分合计 (满分 100 分)', bold: true, rowFlex: RowFlex.CENTER }]
          },
          {
            colspan: 1,
            rowspan: 1,
            backgroundColor: '#F5F5F5',
            value: [{ value: '100', bold: true, rowFlex: RowFlex.CENTER }]
          },
          {
            colspan: 1,
            rowspan: 1,
            backgroundColor: '#F5F5F5',
            value: [{ value: '100', bold: true, color: '#52C41A', rowFlex: RowFlex.CENTER }]
          }
        ]
      }
    ]
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 7. 经典表格示例二：声明式纵向合并同类项表格 (LIS 检验常规，Rowspan 相邻相同合并)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '六、生化与血脂检验明细 (经典示例 2：首列 merge-same 相邻相同合并)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  {
    type: ElementType.TABLE,
    value: '',
    conceptId: 'lis.adjacent_merge_table',
    trList: [
      // 表头
      {
        height: 32,
        tdList: [
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检验分类 (自动纵向合并)', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检测项目', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '结果数值', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '单位', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '参考区间', bold: true }] }
        ]
      },
      // 生化常规检查 (第 0 列跨 3 行合并: rowspan = 3)
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 3, value: [{ value: '生化常规检查', bold: true }] },
          { colspan: 1, rowspan: 1, value: [{ value: '谷丙转氨酶 (ALT)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '25' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'U/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '0-40' }] }
        ]
      },
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '谷草转氨酶 (AST)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '19' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'U/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '0-40' }] }
        ]
      },
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '总胆红素 (TBIL)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '12.4' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'μmol/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '3.4-17.1' }] }
        ]
      },
      // 血脂四项指标 (第 0 列跨 3 行合并: rowspan = 3)
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 3, value: [{ value: '血脂四项指标', bold: true }] },
          { colspan: 1, rowspan: 1, value: [{ value: '总胆固醇 (TC)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '4.2' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'mmol/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '<5.18' }] }
        ]
      },
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '甘油三酯 (TG)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '1.5' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'mmol/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '<1.70' }] }
        ]
      },
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '高密度脂蛋白 (HDL-C)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '1.25' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'mmol/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '>1.04' }] }
        ]
      }
    ]
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 8. 经典表格示例三：大标题通栏合并 + 单元格嵌套多图复合表 (composite.grouped_report)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '七、复合影像化验报告集 (经典示例 3：大标题通栏合并 + 单元格多图)',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  {
    type: ElementType.TABLE,
    value: '',
    conceptId: 'composite.grouped_report',
    trList: [
      // 固定表头
      {
        height: 32,
        tdList: [
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检测指标', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '测定数值', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '参考范围', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '化验报告影像 (多图)', bold: true }] }
        ]
      },
      // 大标题 1 通栏合并 (colspan = 4)
      {
        height: 32,
        tdList: [
          {
            colspan: 4,
            rowspan: 1,
            backgroundColor: '#F2F4F8',
            value: [{ value: '■ 第一组：全血细胞分析与白细胞分类 (WBC/RBC/PLT)', bold: true, size: 13 }]
          }
        ]
      },
      // 组内数据行 1 (含单元格嵌套 2 张图片)
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '白细胞计数 (WBC)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '7.2', color: '#52C41A', bold: true }] },
          { colspan: 1, rowspan: 1, value: [{ value: '3.5-9.5 ×10^9/L' }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value: 'https://picsum.photos/120/80?random=21',
                width: 42,
                height: 42
              },
              { value: ' ' },
              {
                type: ElementType.IMAGE,
                value: 'https://picsum.photos/120/80?random=22',
                width: 42,
                height: 42
              }
            ]
          }
        ]
      },
      // 组内数据行 2
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '红细胞计数 (RBC)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '4.85' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '4.0-5.5 ×10^12/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 大标题 2 通栏合并 (colspan = 4)
      {
        height: 32,
        tdList: [
          {
            colspan: 4,
            rowspan: 1,
            backgroundColor: '#F2F4F8',
            value: [{ value: '■ 第二组：血浆凝血功能四项检测 (PT/APTT/FIB)', bold: true, size: 13 }]
          }
        ]
      },
      // 组内数据行 3 (含 1 张图)
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '纤维蛋白原 (FIB)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '3.12' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '2.0-4.0 g/L' }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value: 'https://picsum.photos/120/80?random=23',
                width: 42,
                height: 42
              }
            ]
          }
        ]
      }
    ]
  },
  {
    value: '\n'
  }
)

export const data: IElement[] = elementList

export const commentList: any[] = []

export const options: IEditorOption = {
  margins: [80, 100, 80, 100],
  pageNumber: {
    format: '第{pageNo}页/共{pageCount}页'
  },
  placeholder: {
    data: '请输入病历报告正文...'
  },
  maskMargin: [60, 0, 30, 0]
}
