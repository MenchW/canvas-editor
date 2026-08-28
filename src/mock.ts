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
        value: '结构化临床诊疗与检验综合报告单',
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
// 2. 患者基础信息行 (含姓名、性别Radio、年龄、头像Image)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '一、患者登记信息',
        size: 15,
        bold: true
      }
    ]
  },
  {
    value: '\n'
  },
  { value: '患者姓名：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.name',
      type: ControlType.TEXT,
      placeholder: '患者姓名',
      value: [{ value: '张三' }]
    }
  },
  { value: '    性别 (Radio单选)：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.gender',
      type: ControlType.RADIO,
      value: null,
      code: '1', // 默认选中 '1' (男)
      flexDirection: FlexDirection.ROW,
      valueSets: [
        { value: '男', code: '1' },
        { value: '女', code: '2' },
        { value: '未知', code: '0' }
      ]
    }
  },
  { value: '    年龄：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.age',
      type: ControlType.TEXT,
      placeholder: '患者年龄',
      value: [{ value: '35岁' }]
    }
  },
  { value: '    患者照片：', bold: true },
  {
    type: ElementType.CONTROL,
    value: '',
    control: {
      conceptId: 'patient.avatar',
      type: ControlType.IMAGE,
      placeholder: '患者正面身份照片',
      width: 48,
      height: 48,
      value: [
        {
          type: ElementType.IMAGE,
          value:
            'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
          width: 48,
          height: 48
        }
      ]
    }
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 3. 场景一：分段式/序号（1, 2, 3, 4）动态列表
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '二、门诊诊断结论 (场景一：分段序号列表)',
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
      conceptId: 'diagnose.diagnosis_items',
      type: ControlType.TEXT,
      placeholder: '临床诊断条目列表 (分段序号)',
      value: [
        { value: '1. ', bold: true },
        { value: '高血压3级（极高危，收缩压≥180mmHg）' },
        { value: '\n' },
        { value: '2. ', bold: true },
        { value: '冠状动脉粥样硬化性心脏病（劳力性心绞痛，CCS II级）' },
        { value: '\n' },
        { value: '3. ', bold: true },
        { value: '2型糖尿病（伴周围神经病变与微量白蛋白尿）' },
        { value: '\n' },
        { value: '4. ', bold: true },
        { value: '高脂血症（混合型高胆固醇与甘油三酯血症）' }
      ]
    }
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 4. 场景三：多段以 Checkbox 开始的长文本条款列表
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '三、知情同意与条款声明 (场景三：多段Checkbox)',
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
      code: 'clause_1,clause_3', // 默认勾选 1 与 3
      flexDirection: FlexDirection.COLUMN,
      valueSets: [
        {
          value: '患者及家属已知悉本次诊疗方案、操作流程及相关并发症风险。',
          code: 'clause_1'
        },
        {
          value: '术前已按临床规范完成血常规、凝血功能及传染病八项筛查。',
          code: 'clause_2'
        },
        {
          value: '经详细病史核实无已知麻醉药物严重过敏史及绝对手术禁忌症。',
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
// 5. 场景四：相邻相同数据动态纵向合并表格 (Rowspan)
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '四、LIS临床检验结果 (场景四：相邻相同自动合并表格)',
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
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检验分类', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检测项目', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '结果数值', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '单位', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '参考区间', bold: true }] }
        ]
      },
      // 生化常规检查 (第 0 列跨 4 行合并: rowspan = 4)
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 4, value: [{ value: '生化常规检查', bold: true }] },
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
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '直接胆红素 (DBIL)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '4.1' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'μmol/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '0-6.8' }] }
        ]
      },
      // 血脂四项指标 (第 0 列跨 4 行合并: rowspan = 4)
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 4, value: [{ value: '血脂四项指标', bold: true }] },
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
      },
      {
        height: 36,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '低密度脂蛋白 (LDL-C)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '2.38' }] },
          { colspan: 1, rowspan: 1, value: [{ value: 'mmol/L' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '<3.37' }] }
        ]
      }
    ]
  },
  {
    value: '\n\n'
  }
)

// ==========================================
// 6. 场景五：带跨列大标题通栏 + 明细循环 + 单元格嵌套多图复合表
// ==========================================
elementList.push(
  {
    value: '',
    type: ElementType.TITLE,
    level: TitleLevel.SECOND,
    valueList: [
      {
        value: '五、多组复合检验报告 (场景五：大标题通栏+嵌套多图)',
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
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检测项目', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '结果数值', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '参考范围', bold: true }] },
          { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '化验报告影像 (多图)', bold: true }] }
        ]
      },
      // 大标题 1 通栏合并 (colspan = 4)
      {
        id: 'tr_g1_header',
        height: 32,
        tdList: [
          {
            id: 'td_g1_header',
            colspan: 4,
            rowspan: 1,
            backgroundColor: '#F2F4F8',
            value: [{ value: '■ 一、血常规检查组 (WBC/RBC/PLT/HGB)', bold: true, size: 13 }]
          }
        ]
      },
      // 组内数据行 1 (含单元格嵌套 2 张图片)
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '白细胞计数 (WBC)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '11.2 ↑', color: '#FF4D4F', bold: true }] },
          { colspan: 1, rowspan: 1, value: [{ value: '4.0-10.0' }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value:
                  'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
                width: 42,
                height: 42
              },
              { value: ' ' },
              {
                type: ElementType.IMAGE,
                value:
                  'https://gips1.baidu.com/it/u=3874035412,3044192377&fm=3028&app=3028&f=JPEG?w=1024&h=1024',
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
          { colspan: 1, rowspan: 1, value: [{ value: '4.55' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '3.5-5.5' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 组内数据行 3
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '血红蛋白浓度 (HGB)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '142' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '120-160' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 组内数据行 4 (含图片)
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '血小板计数 (PLT)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '210' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '100-300' }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value:
                  'https://gips2.baidu.com/it/u=1958261546,408422616&fm=3028&app=3028&f=JPEG?w=1024&h=1024',
                width: 42,
                height: 42
              }
            ]
          }
        ]
      },
      // 大标题 2 通栏合并 (colspan = 4)
      {
        id: 'tr_g2_header',
        height: 32,
        tdList: [
          {
            id: 'td_g2_header',
            colspan: 4,
            rowspan: 1,
            backgroundColor: '#F2F4F8',
            value: [{ value: '■ 二、尿液常规与沉渣镜检分析组', bold: true, size: 13 }]
          }
        ]
      },
      // 组内数据行 5 (含单元格嵌套 1 张图片)
      {
        height: 48,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '尿蛋白定性 (PRO)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '阳性 (+)', color: '#FF4D4F', bold: true }] },
          { colspan: 1, rowspan: 1, value: [{ value: '阴性 (-)' }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.IMAGE,
                value:
                  'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
                width: 42,
                height: 42
              }
            ]
          }
        ]
      },
      // 组内数据行 6
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '尿潜血 (BLD)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '阴性 (-)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '阴性 (-)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 组内数据行 7
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '尿白细胞镜检 (WBC-HP)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '2-4 /HP' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '0-5 /HP' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 大标题 3 通栏合并 (colspan = 4)
      {
        id: 'tr_g3_header',
        height: 32,
        tdList: [
          {
            id: 'td_g3_header',
            colspan: 4,
            rowspan: 1,
            backgroundColor: '#F2F4F8',
            value: [{ value: '■ 三、肝肾代谢与离子生化组', bold: true, size: 13 }]
          }
        ]
      },
      // 组内数据行 8
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '血清肌酐 (Cr)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '88.5' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '53-106' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 组内数据行 9
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '尿素氮 (BUN)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '6.2' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '3.2-7.1' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
        ]
      },
      // 组内数据行 10
      {
        height: 38,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '血清钾 (K+)' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '4.15' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '3.5-5.3' }] },
          { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
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
