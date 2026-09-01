/**
 * 共享 Mock 数据源与 Provider 逻辑
 * 涵盖：全控件形态、声明式合并与汇总、任意层级树形循环、动态条件过滤、以及模板数据可视化诊断工具
 */
;(function (global) {
  // 默认组件字典预设 (按功能特性系统化组织)
  const DEFAULT_COMPONENT_DATA = [
    {
      groupName: '1. 基础字段与独立控件',
      systemName: 'HIS/EMR基础数据系统',
      description: '单字段占位符、多段列表、选项组及多图集合',
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
          conceptId: 'patient.gender',
          name: '患者性别 (Radio单选)',
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
      groupName: '2. 核心功能型表格模板库 (Feature-Driven)',
      systemName: '通用数据表格系统',
      description: '按纯功能特性抽象的标准基准表格，涵盖所有表格渲染形态',
      children: [
        {
          conceptId: 'feature_all_controls_table',
          name: '功能模板 1：全控件全能渲染表 (All-in-One)',
          type: 'table',
          pagingRepeat: false,
          description: '涵盖纯文本、数值、复选框、单选状态、单元格多图及表尾合并合计行',
          htmlTemplate: `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th width="8%" align="center">序号</th>
      <th width="24%" align="center">考核项目与要求</th>
      <th width="14%" align="center">勾选状态</th>
      <th width="26%" align="center">现场照片 (多图)</th>
      <th width="14%" align="center">整改建议</th>
      <th width="14%" align="center">得分</th>
    </tr>
  </thead>
  <tbody>
    <tr loop="item in allControlsData.items">
      <td align="center">{{ item.index }}</td>
      <td>
        <span when="item.isKey"><b>[关键项] </b></span>
        {{ item.itemName }}
      </td>
      <td align="center">
        <input type="checkbox" checked="{{ item.checked }}" /> {{ item.statusText }}
      </td>
      <td align="center">{{ item.images }}</td>
      <td>{{ item.suggest }}</td>
      <td align="center">{{ item.score }}</td>
    </tr>
    <tr>
      <td colspan="5" align="center"><b>合 计</b></td>
      <td align="center"><b>{{ allControlsData.totalScore }}</b></td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'feature_merge_summary_table',
          name: '功能模板 2：声明式动态合并与汇总表 (Merge & Summary)',
          type: 'table',
          pagingRepeat: false,
          description: '首列声明 merge-same 纵向相邻相同数据自动合并，表尾跨列合并合计',
          htmlTemplate: `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th width="20%" align="center">检验大类 (自动合并)</th>
      <th width="25%" align="center">检测项目</th>
      <th width="18%" align="center">结果数值</th>
      <th width="15%" align="center">单位</th>
      <th width="22%" align="center">参考范围</th>
    </tr>
  </thead>
  <tbody>
    <tr loop="item in mergeSummaryData.records">
      <td merge-same align="center">{{ item.category }}</td>
      <td>{{ item.itemName }}</td>
      <td align="center">{{ item.value }}</td>
      <td align="center">{{ item.unit }}</td>
      <td align="center">{{ item.reference }}</td>
    </tr>
    <tr>
      <td colspan="2" align="center"><b>样本检测合格率统计</b></td>
      <td colspan="3" align="center"><b>{{ mergeSummaryData.summaryRate }}</b></td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'feature_hierarchical_loops_table',
          name: '功能模板 3：多层级树形与单元格内循环表 (Hierarchical Loops)',
          type: 'table',
          pagingRepeat: false,
          description: '遵循“谁写了 loop 就循环谁”第一性原理：tbody loop + tr loop + td 内 span 循环',
          htmlTemplate: `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th width="10%" align="center">序号</th>
      <th width="28%" align="center">评估项目与标签</th>
      <th width="22%" align="center">发现问题</th>
      <th width="24%" align="center">现场照片</th>
      <th width="16%" align="center">分值</th>
    </tr>
  </thead>
  <tbody loop="project in hierarchicalData">
    <!-- 一级大类表头 -->
    <tr>
      <td colspan="4" align="left" style="background:#e8f4ff;">
        <b>■ {{ project.projectName }} (满分 {{ project.projectMax }} 分)</b>
      </td>
      <td align="center"><b>{{ project.projectActual }}</b></td>
    </tr>
    <!-- 二级子类表头 -->
    <tr loop="content in project.children">
      <td colspan="4" align="left" style="background:#f2f6fc;">
        <b>● {{ content.contentName }} (满分 {{ content.contentMax }} 分)</b>
      </td>
      <td align="center"><b>{{ content.contentActual }}</b></td>
    </tr>
    <!-- 三级明细行 + 单元格内 span loop 多标签循环 -->
    <tr loop="item in content.children">
      <td align="center">{{ item.index }}</td>
      <td>
        {{ item.title }}<br/>
        <!-- 单元格内 span 循环多标签 -->
        <span loop="tag in item.tags" style="background:#f0f0f0; padding:2px 4px; margin-right:4px;">
          🏷️ {{ tag.name }}
        </span>
      </td>
      <td>{{ item.problem }}</td>
      <td align="center">{{ item.photos }}</td>
      <td align="center">{{ item.score }}</td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'feature_conditional_when_table',
          name: '功能模板 4：动态条件与分支过滤表 (Conditional When)',
          type: 'table',
          pagingRepeat: false,
          description: '根据数据字段通过 when 指令实现行级/单元格级/节点级动态分支显隐',
          htmlTemplate: `<table width="100%" cellpadding="5" cellspacing="0" border="1">
  <thead>
    <tr>
      <th width="12%" align="center">序号</th>
      <th width="38%" align="center">考核内容与指标</th>
      <th width="25%" align="center">状态与预警</th>
      <th width="25%" align="center">得分</th>
    </tr>
  </thead>
  <tbody loop="item in conditionalWhenData">
    <!-- 一级汇总行 (仅 level === 1 时展示) -->
    <tr when="item.level === 1">
      <td colspan="3" align="left" style="background:#f2f4f8;">
        <b>★ {{ item.title }}</b>
      </td>
      <td align="center"><b>{{ item.score }}</b></td>
    </tr>
    <!-- 明细行 (仅 level === 2 时展示) -->
    <tr when="item.level === 2">
      <td align="center">{{ item.index }}</td>
      <td>{{ item.title }}</td>
      <td>
        <span when="item.isWarning" style="color:red; font-weight:bold;">⚠️ 超标预警: </span>
        {{ item.statusText }}
      </td>
      <td align="center">{{ item.score }}</td>
    </tr>
  </tbody>
</table>`
        }
      ]
    },
    {
      groupName: '3. 经典业务复合表格范式',
      systemName: '业务综合应用系统',
      description: '全量保留前期所有经典案例，保证历史模板 100% 兼容',
      children: [
        {
          conceptId: 'scoreSheet',
          name: '食安评分汇总表 (单行明细循环 + 表尾合计行)',
          type: 'table',
          pagingRepeat: false,
          description: '标准单行循环，表尾合计行',
          htmlTemplate: `<table width="100%" cellpadding="0" cellspacing="0" border="1">
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
      <td colspan="2" align="center"><b>合 计</b></td>
      <td align="center">{{ scoreSheet.totalMax }}</td>
      <td align="center">{{ scoreSheet.totalActual }}</td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'riskLevelTable',
          name: '风险级别评估表 (单元格span循环+复选框)',
          type: 'table',
          pagingRepeat: false,
          description: '单元格内 span 循环与复选框勾选',
          htmlTemplate: `<table width="100%" cellpadding="0" cellspacing="0" border="1">
  <tbody>
    <tr>
      <td width="20%" align="center">标化分</td>
      <td width="80%" align="center">{{ standardizedScore }} 分</td>
    </tr>
    <tr>
      <td align="center">风险级别</td>
      <td>
        <div loop="item in riskRuleList">
          <input type="checkbox" checked="{{ item.isChecked }}" /> {{ item.riskLevelName }}：{{ item.desc }}
        </div>
      </td>
    </tr>
    <tr>
      <td align="center">评估结果</td>
      <td align="center">经现场及资料评估，该单位食品安全工作存在 {{ riskLevelText }} 。</td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'lis.adjacent_merge_table',
          name: 'LIS常规检验明细表 (merge-same 合并同类项)',
          type: 'table',
          pagingRepeat: false,
          description: '首列使用 merge-same 指令纵向合并',
          htmlTemplate: `<table border="1" width="100%">
  <thead>
    <tr>
      <th>检验分类</th>
      <th>检测项目</th>
      <th>结果数值</th>
      <th>单位</th>
      <th>参考范围</th>
    </tr>
  </thead>
  <tbody>
    <tr loop="item in lis.records">
      <td merge-same align="center">{{ item.category_name }}</td>
      <td>{{ item.lab_item_name }}</td>
      <td align="center">{{ item.lab_item_value }}</td>
      <td align="center">{{ item.lab_item_unit }}</td>
      <td align="center">{{ item.lab_item_ref }}</td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'composite.grouped_report',
          name: '大标题复合检验影像报告 (通栏合并 + 单元格多图)',
          type: 'table',
          pagingRepeat: false,
          description: '大标题通栏合并，单元格嵌套多图',
          htmlTemplate: `<table border="1" width="100%">
  <thead>
    <tr>
      <th>检测项目</th>
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
      <td>{{ item.itemName }}</td>
      <td align="center">{{ item.result }}</td>
      <td align="center">{{ item.reference }}</td>
      <td align="center">{{ item.imgList }}</td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'groupedData',
          name: '双层多表头复合分组表 (一级大类 + 二级子类 + 三级明细平铺)',
          type: 'table',
          pagingRepeat: false,
          description: '一级大类 + 二级子类 + 三级明细平铺',
          htmlTemplate: `<table width="100%" cellpadding="5" cellspacing="0" border="1">
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
  <tbody loop="group in groupedData">
    <tr>
      <td colspan="5" align="left" style="background:#e8f4ff;">
        <b>{{ group.projectItemName }} (满分 {{ group.projectScore }} 分)</b>
      </td>
      <td align="center"><b>{{ group.projectActualScore }}</b></td>
    </tr>
    <tr>
      <td colspan="5" align="left" style="background:#f2f6fc;">
        <b>{{ group.contentItemName }} (满分 {{ group.contentScore }} 分)</b>
      </td>
      <td align="center"><b>{{ group.contentActualScore }}</b></td>
    </tr>
    <tr loop="item in group.children">
      <td align="center">{{ item.itemIndex }}</td>
      <td>{{ item.evalContent }}</td>
      <td>{{ item.problemDesc }}</td>
      <td align="center">{{ item.images }}</td>
      <td>{{ item.rectifySuggest }}</td>
      <td align="center">{{ item.score }}</td>
    </tr>
  </tbody>
</table>`
        },
        {
          conceptId: 'threeLevelNestedData',
          name: '三层树形嵌套评分表 (一级大类 > 二级子类 > 三级明细)',
          type: 'table',
          pagingRepeat: false,
          description: '三层树形结构嵌套展开',
          htmlTemplate: `<table width="100%" cellpadding="5" cellspacing="0" border="1">
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
  <tbody loop="project in threeLevelNestedData">
    <tr>
      <td colspan="5" align="left" style="background:#e8f4ff;">
        <b>{{ project.projectItemName }} (满分 {{ project.projectScore }} 分)</b>
      </td>
      <td align="center"><b>{{ project.projectActualScore }}</b></td>
    </tr>
    <tr loop="content in project.children">
      <td colspan="5" align="left" style="background:#f2f6fc;">
        <b>{{ content.contentItemName }} (满分 {{ content.contentScore }} 分)</b>
      </td>
      <td align="center"><b>{{ content.contentActualScore }}</b></td>
    </tr>
    <tr loop="item in content.children">
      <td align="center">{{ item.itemIndex }}</td>
      <td>{{ item.evalContent }}</td>
      <td>{{ item.problemDesc }}</td>
      <td align="center">{{ item.images }}</td>
      <td>{{ item.rectifySuggest }}</td>
      <td align="center">{{ item.score }}</td>
    </tr>
  </tbody>
</table>`
        }
      ]
    }
  ]

  const STORAGE_KEY_COMPONENT_DICT = 'CE_COMPONENT_DICTIONARY'

  // 组件字典 Provider
  function mockFetchComponentListApi() {
    try {
      const savedDict = localStorage.getItem(STORAGE_KEY_COMPONENT_DICT)
      if (savedDict) {
        const parsed = JSON.parse(savedDict)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Promise.resolve(parsed)
        }
      }
    } catch (e) {
      console.warn('[mockFetchComponentListApi] 读取本地字典缓存异常，降级至默认预设:', e)
    }
    return Promise.resolve(DEFAULT_COMPONENT_DATA)
  }

  // 模板数据 Provider (包含全部控件类型与三大经典表格范式的全能模板)
  function mockFetchTemplateApi() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: {
            header: [],
            main: [
              // ==========================================
              // 1. 文档大标题
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'first',
                rowFlex: 'center',
                valueList: [
                  {
                    value: '结构化全能诊疗与健康评估综合报告单',
                    size: 20,
                    bold: true
                  }
                ]
              },
              { value: '\n' },

              // ==========================================
              // 2. 模块一：患者登记与基础信息 (Text, Number, Radio, Select, Date, Image)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '一、患者就诊登记与基础信息 (全控件基础形态)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              // 行 1：姓名(Text) + 性别(Radio) + 年龄(Number) + 就诊类型(Select)
              { value: '患者姓名：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.name',
                  type: 'text',
                  placeholder: '请输入姓名',
                  value: [{ value: '张建国' }]
                }
              },
              { value: '    性别 (Radio)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.gender',
                  type: 'radio',
                  value: null,
                  code: '1',
                  flexDirection: 'row',
                  valueSets: [
                    { value: '男', code: '1' },
                    { value: '女', code: '2' },
                    { value: '未知', code: '0' }
                  ]
                }
              },
              { value: '    年龄 (Number)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.age',
                  type: 'number',
                  placeholder: '年龄',
                  value: [{ value: '45' }]
                }
              },
              { value: ' 岁    就诊类型 (Select)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.visit_type',
                  type: 'select',
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
              { value: '\n' },
              // 行 2：就诊科室(Text) + 门诊号(Text) + 就诊日期(Date)
              { value: '就诊科室：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.dept',
                  type: 'text',
                  placeholder: '接诊科室',
                  value: [{ value: '心血管内科一病区' }]
                }
              },
              { value: '    门诊病历号：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.record_no',
                  type: 'text',
                  placeholder: '病历号',
                  value: [{ value: 'EMR202609010088' }]
                }
              },
              { value: '    就诊日期 (Date)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.visit_date',
                  type: 'date',
                  dateFormat: 'YYYY-MM-DD',
                  placeholder: '选择日期',
                  value: [{ value: '2026-09-01' }]
                }
              },
              { value: '\n' },
              // 行 3：头像(Image) + 医生签名(Image)
              { value: '患者头像 (Image)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.avatar',
                  type: 'image',
                  placeholder: '患者照片',
                  width: 52,
                  height: 52,
                  value: [
                    {
                      type: 'image',
                      value: 'https://picsum.photos/120/120?random=101',
                      width: 52,
                      height: 52
                    }
                  ]
                }
              },
              { value: '       接诊医师签名章 (Image)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'doctor.signature',
                  type: 'image',
                  placeholder: '医生签名',
                  width: 90,
                  height: 40,
                  value: [
                    {
                      type: 'image',
                      value: 'https://picsum.photos/180/80?random=102',
                      width: 90,
                      height: 40
                    }
                  ]
                }
              },
              { value: '\n\n' },

              // ==========================================
              // 3. 模块二：生命体征与生理测量 (Number 数值测量组)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '二、生命体征与生理测量 (Number 测量数值组)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              { value: '体温 (T)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'vitals.temperature',
                  type: 'number',
                  placeholder: '体温',
                  value: [{ value: '36.6' }]
                }
              },
              { value: ' ℃    收缩压 (SBP)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'vitals.sbp',
                  type: 'number',
                  placeholder: '高压',
                  value: [{ value: '135' }]
                }
              },
              { value: ' mmHg    舒张压 (DBP)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'vitals.dbp',
                  type: 'number',
                  placeholder: '低压',
                  value: [{ value: '88' }]
                }
              },
              { value: ' mmHg    心率 (HR)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'vitals.heart_rate',
                  type: 'number',
                  placeholder: '心率',
                  value: [{ value: '78' }]
                }
              },
              { value: ' 次/分    体重：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'vitals.weight',
                  type: 'number',
                  placeholder: '体重',
                  value: [{ value: '68.5' }]
                }
              },
              { value: ' kg\n\n' },

              // ==========================================
              // 4. 模块三：既往病史与临床诊断 (Checkbox复选 + 多段文本列表)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '三、既往病史与临床诊断 (Checkbox复选 + 多段文本列表)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              { value: '既往疾病筛查 (Checkbox 多选)：', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'patient.past_history',
                  type: 'checkbox',
                  value: null,
                  code: 'hbp,dm',
                  flexDirection: 'row',
                  valueSets: [
                    { value: '原发性高血压', code: 'hbp' },
                    { value: '2型糖尿病', code: 'dm' },
                    { value: '冠状动脉粥样硬化', code: 'chd' },
                    { value: '青霉素/磺胺过敏史', code: 'allergy' },
                    { value: '慢性支气管炎', code: 'copd' }
                  ]
                }
              },
              { value: '\n初步门诊诊断结论 (List.Text 分段条目)：\n', bold: true },
              {
                type: 'control',
                value: '',
                control: {
                  conceptId: 'diagnose.diagnosis_items',
                  type: 'text',
                  placeholder: '临床诊断条目列表',
                  value: [
                    { value: '1. ', bold: true },
                    { value: '高血压2级（中危组，血压控制稳定）\n' },
                    { value: '2. ', bold: true },
                    { value: '2型糖尿病（伴轻度周围神经病变）\n' },
                    { value: '3. ', bold: true },
                    { value: '高脂血症（高甘油三酯血症，轻度）' }
                  ]
                }
              },
              { value: '\n\n' },

              // ==========================================
              // 5. 模块四：知情同意与条款签署 (Checkbox 纵向多段条款)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '四、诊疗知情同意与风险告知 (Checkbox 纵向多段条款)',
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
                  code: 'clause_1,clause_2,clause_3',
                  flexDirection: 'column',
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
              { value: '\n\n' },

              // ==========================================
              // 6. 经典表格示例一：全控件全能渲染考核表 (单行明细循环 + 关键项 + 复选框 + 现场多图 + 表尾合计行)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '五、临床医疗质量与安全考核表 (经典示例 1：全控件+表尾合并合计行)',
                    size: 15,
                    bold: true
                  }
                ]
              },
              { value: '\n' },
              {
                type: 'table',
                value: '',
                conceptId: 'feature_all_controls_table',
                trList: [
                  {
                    height: 32,
                    tdList: [
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '序号', bold: true, rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '质控考核项目与规范', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '核查状态', bold: true, rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '现场影像佐证 (多图)', bold: true, rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '标准分', bold: true, rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '实得分', bold: true, rowFlex: 'center' }] }
                    ]
                  },
                  {
                    height: 48,
                    tdList: [
                      { colspan: 1, rowspan: 1, value: [{ value: '1', rowFlex: 'center' }] },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [
                          { value: '[关键项] ', bold: true, color: '#1890FF' },
                          { value: '严格落实首诊负责制与急危重症抢救制度' }
                        ]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '☑ 符合规范', color: '#52C41A', bold: true, rowFlex: 'center' }] },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [
                          {
                            type: 'image',
                            value: 'https://picsum.photos/120/80?random=11',
                            width: 48,
                            height: 36
                          }
                        ]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: 'center', bold: true }] }
                    ]
                  },
                  {
                    height: 48,
                    tdList: [
                      { colspan: 1, rowspan: 1, value: [{ value: '2', rowFlex: 'center' }] },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [
                          { value: '[核心项] ', bold: true, color: '#FAAD14' },
                          { value: '三级查房记录在患者入院 24/48 小时内完成' }
                        ]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '☑ 符合规范', color: '#52C41A', bold: true, rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '无附件', color: '#999999', rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '30', rowFlex: 'center', bold: true }] }
                    ]
                  },
                  {
                    height: 48,
                    tdList: [
                      { colspan: 1, rowspan: 1, value: [{ value: '3', rowFlex: 'center' }] },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [
                          { value: '[安全项] ', bold: true, color: '#FF4D4F' },
                          { value: '处方与用药医嘱严格实行双人核对制度' }
                        ]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '☑ 符合规范', color: '#52C41A', bold: true, rowFlex: 'center' }] },
                      {
                        colspan: 1,
                        rowspan: 1,
                        value: [
                          {
                            type: 'image',
                            value: 'https://picsum.photos/120/80?random=12',
                            width: 48,
                            height: 36
                          }
                        ]
                      },
                      { colspan: 1, rowspan: 1, value: [{ value: '40', rowFlex: 'center' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '40', rowFlex: 'center', bold: true }] }
                    ]
                  },
                  {
                    height: 36,
                    tdList: [
                      {
                        colspan: 4,
                        rowspan: 1,
                        backgroundColor: '#F5F5F5',
                        value: [{ value: '考核汇总得分合计 (满分 100 分)', bold: true, rowFlex: 'center' }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#F5F5F5',
                        value: [{ value: '100', bold: true, rowFlex: 'center' }]
                      },
                      {
                        colspan: 1,
                        rowspan: 1,
                        backgroundColor: '#F5F5F5',
                        value: [{ value: '100', bold: true, color: '#52C41A', rowFlex: 'center' }]
                      }
                    ]
                  }
                ]
              },
              { value: '\n\n' },

              // ==========================================
              // 7. 经典表格示例二：生化与血脂检验明细 (首列 merge-same 相邻相同合并)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '六、生化与血脂检验明细 (经典示例 2：首列 merge-same 相邻相同合并)',
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
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检验分类 (自动纵向合并)', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检测项目', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '结果数值', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '单位', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '参考区间', bold: true }] }
                    ]
                  },
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
              { value: '\n\n' },

              // ==========================================
              // 8. 经典表格示例三：复合影像化验报告集 (大标题通栏合并 + 单元格多图)
              // ==========================================
              {
                value: '',
                type: 'title',
                level: 'second',
                valueList: [
                  {
                    value: '七、复合影像化验报告集 (经典示例 3：大标题通栏合并 + 单元格多图)',
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
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '检测指标', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '测定数值', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '参考范围', bold: true }] },
                      { colspan: 1, rowspan: 1, backgroundColor: '#FAFAFA', value: [{ value: '化验报告影像 (多图)', bold: true }] }
                    ]
                  },
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
                            type: 'image',
                            value: 'https://picsum.photos/120/80?random=21',
                            width: 42,
                            height: 42
                          },
                          { value: ' ' },
                          {
                            type: 'image',
                            value: 'https://picsum.photos/120/80?random=22',
                            width: 42,
                            height: 42
                          }
                        ]
                      }
                    ]
                  },
                  {
                    height: 38,
                    tdList: [
                      { colspan: 1, rowspan: 1, value: [{ value: '红细胞计数 (RBC)' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '4.85' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '4.0-5.5 ×10^12/L' }] },
                      { colspan: 1, rowspan: 1, value: [{ value: '-' }] }
                    ]
                  },
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
                            type: 'image',
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
              { value: '\n' }
            ],
            footer: []
          },
          options: {
            margins: [80, 100, 80, 100],
            pageNumber: { format: '第{pageNo}页/共{pageCount}页' }
          }
        })
      }, 0)
    })
  }

  // 业务数据 Provider (纯净、无冗余、1:1 覆盖所有功能与业务场景)
  function mockFetchBusinessDataApi() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          // 基础标量与就诊信息
          patient: {
            name: '张建国',
            age: '45',
            dept: '心血管内科一病区',
            record_no: 'EMR202609010088',
            visit_date: '2026-09-01',
            visit_type: 'expert',
            gender: '1',
            past_history: 'hbp,dm',
            avatar: 'https://picsum.photos/120/120?random=101'
          },
          doctor: {
            signature: 'https://picsum.photos/180/80?random=102'
          },
          // 生命体征数值
          vitals: {
            temperature: '36.6',
            sbp: '135',
            dbp: '88',
            heart_rate: '78',
            weight: '68.5'
          },
          standardizedScore: 92.5,
          riskLevelText: '一般风险',

          // 列表与选项组
          diagnose: {
            diagnosis_items: [
              { label: '1. 高血压2级（中危组，血压控制稳定）', code: 'I10.001' },
              { label: '2. 2型糖尿病（伴轻度周围神经病变）', code: 'E11.900' },
              { label: '3. 高脂血症（高甘油三酯血症，轻度）', code: 'E78.100' }
            ]
          },
          surgery: {
            consent_clauses: [
              { label: '患者及代理人已被充分告知治疗方案、预期疗效及可能伴随的不良反应。', checked: true },
              { label: '核实无近期重大创伤手术史、活动性出血倾向及严重麻醉药物过敏史。', checked: true },
              { label: '同意严格遵照医嘱按时规范用药，定期进行血糖、血压及肝肾功能随访复查。', checked: true }
            ]
          },
          exam: {
            report_images: [
              'https://picsum.photos/200/200?random=1',
              'https://picsum.photos/200/200?random=2'
            ]
          },

          // -------------------------------------------------------------
          // 功能模板 1 数据源：全控件全能渲染表
          // -------------------------------------------------------------
          allControlsData: {
            items: [
              {
                index: 1,
                itemName: '持有效《食品经营许可证》并醒目悬挂',
                isKey: true,
                checked: true,
                statusText: '符合',
                images: ['https://picsum.photos/120/80?random=11'],
                suggest: '规范完好',
                score: 10
              },
              {
                index: 2,
                itemName: '从严落实直接接触入口食品人员健康证明',
                isKey: false,
                checked: true,
                statusText: '符合',
                images: [],
                suggest: '无异常',
                score: 10
              },
              {
                index: 3,
                itemName: '食品原料库房离地离墙、防鼠防虫设施完备',
                isKey: true,
                checked: false,
                statusText: '不符合',
                images: [
                  'https://picsum.photos/120/80?random=12',
                  'https://picsum.photos/120/80?random=13'
                ],
                suggest: '防鼠板损坏需立即更换',
                score: 0
              }
            ],
            totalScore: 20
          },

          // -------------------------------------------------------------
          // 功能模板 2 数据源：声明式动态合并与汇总表
          // -------------------------------------------------------------
          mergeSummaryData: {
            records: [
              { category: '生化常规检查', itemName: '谷丙转氨酶 (ALT)', value: '25', unit: 'U/L', reference: '0-40' },
              { category: '生化常规检查', itemName: '谷草转氨酶 (AST)', value: '19', unit: 'U/L', reference: '0-40' },
              { category: '生化常规检查', itemName: '总胆红素 (TBIL)', value: '12.4', unit: 'μmol/L', reference: '3.4-17.1' },
              { category: '血脂四项指标', itemName: '总胆固醇 (TC)', value: '4.2', unit: 'mmol/L', reference: '<5.18' },
              { category: '血脂四项指标', itemName: '甘油三酯 (TG)', value: '1.5', unit: 'mmol/L', reference: '<1.70' },
              { category: '血脂四项指标', itemName: '高密度脂蛋白 (HDL-C)', value: '1.25', unit: 'mmol/L', reference: '>1.04' }
            ],
            summaryRate: '98.5% (符合临床质量控制标准)'
          },

          // -------------------------------------------------------------
          // 功能模板 3 数据源：多层级树形与单元格内嵌套循环表
          // -------------------------------------------------------------
          hierarchicalData: [
            {
              projectName: '基础资质与制度体系',
              projectMax: 50,
              projectActual: 50,
              children: [
                {
                  contentName: '证照与人员管理',
                  contentMax: 50,
                  contentActual: 50,
                  children: [
                    {
                      index: 1,
                      title: '食堂持有效食品经营许可证且无涂改行为',
                      tags: [{ name: '关键项' }, { name: '高频核查' }],
                      problem: '暂无问题',
                      photos: [],
                      score: 25
                    },
                    {
                      index: 2,
                      title: '从业人员健康证均在有效期内',
                      tags: [{ name: '日常核查' }],
                      problem: '暂无问题',
                      photos: [],
                      score: 25
                    }
                  ]
                }
              ]
            },
            {
              projectName: '加工制作过程安全',
              projectMax: 50,
              projectActual: 40,
              children: [
                {
                  contentName: '初加工与烹饪环节',
                  contentMax: 50,
                  contentActual: 40,
                  children: [
                    {
                      index: 3,
                      title: '荤素水产清洗池分开设置且标识清晰',
                      tags: [{ name: '关键项' }, { name: '硬件设施' }],
                      problem: '水产清洗池标识脱落',
                      photos: ['https://picsum.photos/120/80?random=14'],
                      score: 15
                    },
                    {
                      index: 4,
                      title: '烹饪食品中心温度达 70℃ 以上',
                      tags: [{ name: '过程控制' }],
                      problem: '暂无问题',
                      photos: [],
                      score: 25
                    }
                  ]
                }
              ]
            }
          ],

          // -------------------------------------------------------------
          // 功能模板 4 数据源：动态条件与分支过滤表
          // -------------------------------------------------------------
          conditionalWhenData: [
            { level: 1, title: '第一部分：资质证照与合规准入（满分 50 分）', score: '50 分' },
            { level: 2, index: 1, title: '食品经营许可证有效合法', isWarning: false, statusText: '正常合规', score: 25 },
            { level: 2, index: 2, title: '承包企业准入退出机制建立健全', isWarning: false, statusText: '正常合规', score: 25 },
            { level: 1, title: '第二部分：现场卫生与仓储管理（满分 50 分）', score: '35 分' },
            { level: 2, index: 3, title: '库房防鼠防潮设施完备', isWarning: true, statusText: '挡鼠板高度不足 60cm', score: 15 },
            { level: 2, index: 4, title: '冷藏冷冻温度达到规定标准', isWarning: false, statusText: '温度正常', score: 20 }
          ],

          // -------------------------------------------------------------
          // 经典业务场景数据源 1：食安评分表 (scoreSheet)
          // -------------------------------------------------------------
          scoreSheet: {
            items: [
              { index: 1, itemName: '基础资质与制度体系', maxScore: 5, actualScore: 5 },
              { index: 2, itemName: '场所环境卫生与设施设备', maxScore: 10, actualScore: 10 },
              { index: 3, itemName: '食材采购与溯源管理', maxScore: 10, actualScore: 10 },
              { index: 4, itemName: '贮存与仓储环境', maxScore: 5, actualScore: 5 },
              { index: 5, itemName: '加工制作环节', maxScore: 20, actualScore: 20 },
              { index: 6, itemName: '食品留样与废弃物处置', maxScore: 10, actualScore: 10 },
              { index: 7, itemName: '餐具消毒与保洁管控', maxScore: 10, actualScore: 10 },
              { index: 8, itemName: '人员健康管理', maxScore: 10, actualScore: 10 },
              { index: 9, itemName: '有害生物防制', maxScore: 5, actualScore: 5 },
              { index: 10, itemName: '制止餐饮浪费', maxScore: 2, actualScore: 2 },
              { index: 11, itemName: '食品安全管理', maxScore: 13, actualScore: 13 }
            ],
            totalMax: 100,
            totalActual: 100
          },

          // -------------------------------------------------------------
          // 经典业务场景数据源 2：风险规则列表 (riskRuleList)
          // -------------------------------------------------------------
          riskRuleList: [
            { riskLevelName: '重大风险', desc: '关键项不符合 ≥ 1项 或 得分 < 70分', isChecked: false },
            { riskLevelName: '较大风险', desc: '关键项不符合 < 1项 且 得分 介于 70-85分', isChecked: false },
            { riskLevelName: '一般风险', desc: '关键项不符合 < 1项 且 得分 ≥ 85分', isChecked: true }
          ],

          // -------------------------------------------------------------
          // 经典业务场景数据源 3：LIS 常规检验明细 (lis.records)
          // -------------------------------------------------------------
          lis: {
            records: [
              { category_name: '生化常规检查', lab_item_name: 'ALT (谷丙转氨酶)', lab_item_value: '25', lab_item_unit: 'U/L', lab_item_ref: '0-40' },
              { category_name: '生化常规检查', lab_item_name: 'AST (谷草转氨酶)', lab_item_value: '19', lab_item_unit: 'U/L', lab_item_ref: '0-40' },
              { category_name: '生化常规检查', lab_item_name: 'TBIL (总胆红素)', lab_item_value: '12.4', lab_item_unit: 'μmol/L', lab_item_ref: '3.4-17.1' },
              { category_name: '血脂四项指标', lab_item_name: 'TC (总胆固醇)', lab_item_value: '4.2', lab_item_unit: 'mmol/L', lab_item_ref: '<5.18' },
              { category_name: '血脂四项指标', lab_item_name: 'TG (甘油三酯)', lab_item_value: '1.5', lab_item_unit: 'mmol/L', lab_item_ref: '<1.70' },
              { category_name: '血脂四项指标', lab_item_name: 'HDL-C (高密度脂蛋白)', lab_item_value: '1.25', lab_item_unit: 'mmol/L', lab_item_ref: '>1.04' },
              { category_name: '血脂四项指标', lab_item_name: 'LDL-C (低密度脂蛋白)', lab_item_value: '2.38', lab_item_unit: 'mmol/L', lab_item_ref: '<3.37' }
            ]
          },

          // -------------------------------------------------------------
          // 经典业务场景数据源 4：大标题复合检验影像报告 (composite)
          // -------------------------------------------------------------
          composite: {
            grouped_report: [
              {
                title: '血常规分析检验报告',
                children: [
                  { itemName: '白细胞计数 (WBC)', result: '7.2', reference: '3.5-9.5 ×10^9/L', imgList: ['https://picsum.photos/120/80?random=21'] },
                  { itemName: '红细胞计数 (RBC)', result: '4.85', reference: '4.0-5.5 ×10^12/L', imgList: [] }
                ]
              },
              {
                title: '凝血四项检验报告',
                children: [
                  { itemName: '凝血酶原时间 (PT)', result: '11.8', reference: '11.0-14.5 秒', imgList: [] },
                  { itemName: '纤维蛋白原 (FIB)', result: '3.12', reference: '2.0-4.0 g/L', imgList: ['https://picsum.photos/120/80?random=22'] }
                ]
              }
            ]
          },

          // -------------------------------------------------------------
          // 经典业务场景数据源 5：双层多表头复合分组表 (groupedData)
          // -------------------------------------------------------------
          groupedData: [
            {
              projectItemName: '资质与制度体系（关键）',
              projectScore: 100,
              projectActualScore: 90,
              contentItemName: '许可管理（关键）',
              contentScore: 50,
              contentActualScore: 50,
              children: [
                { itemIndex: 1, evalContent: '★ 食堂持有效《食品经营许可证》', problemDesc: '暂无', images: [], score: 10, rectifySuggest: '暂无' },
                { itemIndex: 2, evalContent: '★ 许可证无涂改、出租等行为', problemDesc: '暂无', images: [], score: 10, rectifySuggest: '暂无' },
                { itemIndex: 5, evalContent: '★ 建立承包准入退出机制', problemDesc: '暂无', images: [], score: 10, rectifySuggest: '暂无' }
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
                { itemIndex: 6, evalContent: '★ 在就餐区醒目位置公示证照', problemDesc: '暂无', images: [], score: 10, rectifySuggest: '暂无' },
                { itemIndex: 10, evalContent: '★ 公示食品添加剂使用品种与用量', problemDesc: '未完整公示用量', images: ['https://picsum.photos/120/80?random=23'], score: 0, rectifySuggest: '立即补齐' }
              ]
            }
          ],

          // -------------------------------------------------------------
          // 经典业务场景数据源 6：三层树形嵌套评分表 (threeLevelNestedData)
          // -------------------------------------------------------------
          threeLevelNestedData: [
            {
              projectName: '基础资质与制度体系',
              projectItemName: '基础资质与制度体系（关键）',
              projectMax: 50,
              projectScore: 50,
              projectActual: 50,
              projectActualScore: 50,
              children: [
                {
                  contentName: '证照与人员管理',
                  contentItemName: '证照与人员管理（满分 50 分）',
                  contentMax: 50,
                  contentScore: 50,
                  contentActual: 50,
                  contentActualScore: 50,
                  children: [
                    {
                      index: 1,
                      itemIndex: 1,
                      title: '食堂持有效食品经营许可证且无涂改行为',
                      evalContent: '★ 食堂持有效《食品经营许可证》且无涂改',
                      tags: [{ name: '关键项' }, { name: '资质合规' }],
                      problem: '暂无问题',
                      problemDesc: '暂无',
                      photos: '-',
                      images: [],
                      score: 25,
                      rectifySuggest: '暂无'
                    },
                    {
                      index: 2,
                      itemIndex: 2,
                      title: '从业人员健康证明均在有效期内',
                      evalContent: '★ 从业人员健康证明均在有效期内且醒目公示',
                      tags: [{ name: '人员管理' }, { name: '每日晨检' }],
                      problem: '暂无问题',
                      problemDesc: '暂无',
                      photos: '-',
                      images: [],
                      score: 25,
                      rectifySuggest: '暂无'
                    }
                  ]
                }
              ]
            },
            {
              projectName: '加工制作过程管控',
              projectItemName: '加工制作过程（合理）',
              projectMax: 50,
              projectScore: 50,
              projectActual: 40,
              projectActualScore: 40,
              children: [
                {
                  contentName: '初加工与清洗消毒',
                  contentItemName: '初加工（合理）',
                  contentMax: 50,
                  contentScore: 50,
                  contentActual: 40,
                  contentActualScore: 40,
                  children: [
                    {
                      index: 3,
                      itemIndex: 3,
                      title: '分开设置荤素水产清洗池并设明显标识',
                      evalContent: '分开设置荤素水产清洗池',
                      tags: [{ name: '洗消规范' }],
                      problem: '水产池标识轻微磨损',
                      problemDesc: '标识磨损',
                      photos: '-',
                      images: [],
                      score: 20,
                      rectifySuggest: '更换新标识'
                    },
                    {
                      index: 4,
                      itemIndex: 4,
                      title: '餐饮具清洗消毒保洁设施运转正常',
                      evalContent: '餐饮具清洗消毒保洁设施运转正常',
                      tags: [{ name: '消毒记录' }],
                      problem: '消毒温度记录完整',
                      problemDesc: '记录完整',
                      photos: '-',
                      images: [],
                      score: 20,
                      rectifySuggest: '继续保持'
                    }
                  ]
                }
              ]
            }
          ],

          // -------------------------------------------------------------
          // 经典业务场景数据源 7：扁平混合条件表 (flattenedData)
          // -------------------------------------------------------------
          flattenedData: [
            { isCategoryHeader: true, projectItemName: '基础资质与制度体系', projectScore: 5, projectActualScore: 5 },
            { isCategoryHeader: false, itemIndex: 1, isKeyItem: true, evalContent: '持有效许可证', problemDesc: '暂无', images: [], rectifySuggest: '暂无', score: 5 },
            { isCategoryHeader: true, projectItemName: '加工制作环节管理', projectScore: 10, projectActualScore: 10 },
            { isCategoryHeader: false, itemIndex: 2, isKeyItem: false, evalContent: '成品加盖密闭存放', problemDesc: '暂无', images: [], rectifySuggest: '暂无', score: 10 }
          ]
        })
      }, 0)
    })
  }

  // -------------------------------------------------------------
  // 控制台专属：表格回显深度诊断与排查工具 (debugTable / debugTableEcho)
  // -------------------------------------------------------------
  function debugTable(tableHtml, businessData) {
    if (!tableHtml || typeof tableHtml !== 'string') {
      console.warn('%c[debugTable] 请传入 table HTML 字符串，例如: debugTable("<table...</table>")', 'color:#f5222d;font-weight:bold;')
      return
    }
    // 获取数据源
    let data = businessData
    if (!data) {
      if (global.DEFAULT_BUSINESS_DATA) {
        data = global.DEFAULT_BUSINESS_DATA
      }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(tableHtml, 'text/html')
    const table = doc.querySelector('table')
    if (!table) {
      console.error('%c[debugTable] 传入的字符串中未找到 <table> 标签，请检查 HTML 是否完整闭合！', 'color:#f5222d;font-weight:bold;')
      return
    }

    const declaredLoops = []
    const fieldsAudit = []
    const warnings = []

    function getPathValue(obj, path) {
      if (!obj || !path) return undefined
      const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.')
      let cur = obj
      for (const p of parts) {
        if (cur === null || cur === undefined) return undefined
        cur = cur[p]
      }
      return cur
    }

    // 1. 查找 tbody/tr loop
    const tbodies = Array.from(table.querySelectorAll('tbody'))
    tbodies.forEach((tbody, tbIdx) => {
      const tbodyLoop = tbody.getAttribute('loop')
      if (tbodyLoop) {
        const m = tbodyLoop.match(/(?:let|var|const)?\s*(\w+)\s+in\s+([\w\.]+)/)
        const alias = m ? m[1] : 'item'
        const path = m ? m[2] : tbodyLoop.trim()
        const subData = getPathValue(data, path)
        const isArr = Array.isArray(subData)
        declaredLoops.push({
          位置: `tbody #${tbIdx + 1}`,
          类型: 'tbody 块级循环',
          别名: alias,
          数据路径: path,
          数据是否存在: isArr ? `✔ 存在 (${subData.length} 条)` : '✖ 不存在或非数组'
        })
        if (!isArr) {
          warnings.push(`tbody 循环路径 [${path}] 在数据源中不存在！`)
        }
      }
    })

    const trs = Array.from(table.querySelectorAll('tr'))
    trs.forEach((tr, rIdx) => {
      const trLoop = tr.getAttribute('loop')
      if (trLoop) {
        const m = trLoop.match(/(?:let|var|const)?\s*(\w+)\s+in\s+([\w\.]+)/)
        const alias = m ? m[1] : 'item'
        const path = m ? m[2] : trLoop.trim()
        const subData = getPathValue(data, path)
        const isArr = Array.isArray(subData)
        declaredLoops.push({
          位置: `第 ${rIdx + 1} 行 tr`,
          类型: 'tr 行循环',
          别名: alias,
          数据路径: path,
          数据是否存在: isArr ? `✔ 存在 (${subData.length} 条)` : '✖ 不存在或非数组'
        })
      }

      // 提取单元格中的占位符
      const cells = Array.from(tr.querySelectorAll('th, td'))
      cells.forEach((cell, cIdx) => {
        const cellText = cell.innerHTML
        const matches = cellText.match(/\{\{\s*([\w\.\-]+)\s*\}\}/g) || []
        matches.forEach(m => {
          const rawKey = m.replace(/^\{\{\s*|\s*\}\}$/g, '')
          const parts = rawKey.split('.')
          const alias = parts[0]
          const fieldKey = parts.slice(1).join('.') || rawKey

          let resolvedVal = undefined
          let matched = false

          const targetLoop = declaredLoops.find(l => l.别名 === alias)
          if (targetLoop && data) {
            const loopList = getPathValue(data, targetLoop.数据路径)
            if (Array.isArray(loopList) && loopList.length > 0) {
              const firstRow = loopList[0]
              if (firstRow && typeof firstRow === 'object' && fieldKey in firstRow) {
                resolvedVal = firstRow[fieldKey]
                matched = true
              }
            }
          }

          if (!matched && data) {
            const directVal = getPathValue(data, fieldKey) || getPathValue(data, rawKey)
            if (directVal !== undefined) {
              resolvedVal = directVal
              matched = true
            }
          }

          fieldsAudit.push({
            单元格: `第 ${rIdx + 1} 行第 ${cIdx + 1} 列`,
            占位符: `{{ ${rawKey} }}`,
            字段名: fieldKey,
            别名: alias,
            首行回显模拟值: matched ? (typeof resolvedVal === 'object' ? JSON.stringify(resolvedVal) : String(resolvedVal)) : '✖ NOT_FOUND',
            匹配状态: matched ? '🟢 MATCHED' : '🔴 未匹配到数据'
          })
        })
      })
    })

    const isSuccess = warnings.length === 0 && (fieldsAudit.length === 0 || fieldsAudit.some(f => f.匹配状态.includes('MATCHED')))

    console.group(`%c[debugTable 表格回显深度诊断] ${isSuccess ? '✔ 回显成功' : '✖ 发现潜在配置异常'}`, isSuccess ? 'background:#52c41a;color:#fff;font-weight:bold;padding:4px 10px;border-radius:4px;' : 'background:#f5222d;color:#fff;font-weight:bold;padding:4px 10px;border-radius:4px;')

    if (warnings.length > 0) {
      console.group('%c⚠ 告警与诊断建议', 'color:#fa8c16;font-weight:bold;')
      warnings.forEach(w => console.warn('• ' + w))
      console.groupEnd()
    }

    if (declaredLoops.length > 0) {
      console.group('%c🔄 循环声明与数据源映射', 'color:#1890ff;font-weight:bold;')
      console.table(declaredLoops)
      console.groupEnd()
    }

    if (fieldsAudit.length > 0) {
      console.group('%c📋 占位符字段匹配明细表', 'color:#722ed1;font-weight:bold;')
      console.table(fieldsAudit)
      console.groupEnd()
    }

    console.log('📥 传入的业务数据:', data)
    console.groupEnd()

    return { success: isSuccess, declaredLoops, fieldsAudit, warnings }
  }

  // 挂载到全局
  global.DEFAULT_COMPONENT_DATA = DEFAULT_COMPONENT_DATA
  global.mockFetchComponentListApi = mockFetchComponentListApi
  global.mockFetchTemplateApi = mockFetchTemplateApi
  global.mockFetchBusinessDataApi = mockFetchBusinessDataApi
  global.debugTable = debugTable
  global.debugTableEcho = debugTable
})(typeof window !== 'undefined' ? window : this)
