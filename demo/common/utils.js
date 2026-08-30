/**
 * 通用工具与数据归一化函数
 */
;(function (global) {
  /**
   * 点号嵌套设值 (如 setNestedValue(obj, 'patient.name', '张三'))
   */
  function setNestedValue(obj, path, value) {
    if (!path || !obj || typeof obj !== 'object') return
    const parts = String(path).split('.')
    let cur = obj
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (
        !cur[part] ||
        typeof cur[part] !== 'object' ||
        Array.isArray(cur[part])
      ) {
        cur[part] = {}
      }
      cur = cur[part]
    }
    cur[parts[parts.length - 1]] = value
  }

  /**
   * 根据字段定义生成对应的默认值或 Mock 结构
   */
  function getFieldValueOrType(field) {
    if (!field) return ''
    const type = field.type || 'text'
    const listType = field.listType || 'text'

    if (type === 'list') {
      if (listType === 'radio') {
        return [
          { label: '男', value: '1', checked: false },
          { label: '女', value: '2', checked: true },
          { label: '未知', value: '0', checked: false }
        ]
      }
      if (listType === 'checkbox') {
        return [
          {
            label: '1. 患者及家属已知悉本次诊疗方案与风险。',
            value: 'clause_1',
            checked: true
          },
          {
            label: '2. 术前已按规范完成血常规及凝血功能筛查。',
            value: 'clause_2',
            checked: false
          },
          {
            label: '3. 经病史核实无已知麻醉药物严重过敏史。',
            value: 'clause_3',
            checked: true
          }
        ]
      }
      if (listType === 'image') {
        return [
          'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440',
          'https://gips0.baidu.com/it/u=163643473,1997243702&fm=3074&app=3074&f=PNG?w=2560&h=1440'
        ]
      }
      return [
        { label: '1. 高血压3级（极高危）', code: 'item_1' },
        { label: '2. 冠状动脉粥样硬化性心脏病', code: 'item_2' }
      ]
    }

    if (type === 'radio' || type === 'checkbox') {
      return '1'
    }

    if (type === 'number') {
      return 0
    }
    return type
  }

  /**
   * 根据分组内字段列表一键生成 Mock 回显数据 Payload
   */
  function buildGroupMockPayload(group) {
    if (!group || !Array.isArray(group.children)) return {}
    const payload = {}

    group.children.forEach(field => {
      const key = (field.conceptId || '').trim()
      if (!key) return
      setNestedValue(payload, key, getFieldValueOrType(field))
    })

    return payload
  }

  /**
   * 字段实体属性双向归一化映射 (兼容 RuoYi 后端属性与 Canvas-Editor 前端属性)
   */
  function normalizeField(f) {
    if (!f) return f
    const name = f.name || f.fieldName || f.conceptName || ''
    const conceptId = f.conceptId || f.fieldKey || f.fieldPath || f.key || ''
    const type = f.type || f.fieldType || f.controlType || 'text'
    const description = f.description || f.fieldDesc || ''
    const listType = f.listType || 'text'
    const layout = f.layout || 'vertical'
    const gridCols = Number(f.gridCols) || 2
    const htmlTemplate = f.htmlTemplate || f.html_template || ''
    const pagingRepeat =
      f.pagingRepeat !== undefined ? Boolean(f.pagingRepeat) : false

    return {
      ...f,
      id: f.id,
      name,
      fieldName: name,
      conceptId,
      fieldKey: conceptId,
      type,
      fieldType: type,
      description,
      fieldDesc: description,
      listType,
      layout,
      gridCols,
      htmlTemplate,
      pagingRepeat
    }
  }

  /**
   * 分组实体属性双向归一化映射
   */
  function normalizeGroup(g) {
    if (!g) return g
    const rawChildren = g.children || g.fieldList || g.fields || []
    const children = Array.isArray(rawChildren)
      ? rawChildren.map(normalizeField)
      : []
    return {
      ...g,
      id: g.id || g.groupId,
      groupName: g.groupName || g.name || '',
      systemName: g.systemName || '',
      description: g.description || g.fieldDesc || '',
      children
    }
  }

  /**
   * 根据系统标识/名称通过哈希计算出固定一致的美观系统标签配色
   */
  function getSystemStyle(sys) {
    const colorList = [
      { color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' },
      { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' },
      { color: '#6d28d9', background: '#f5f3ff', borderColor: '#ddd6fe' },
      { color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' },
      { color: '#0e7490', background: '#ecfeff', borderColor: '#a5f3fc' },
      { color: '#334155', background: '#f1f5f9', borderColor: '#cbd5e1' }
    ]
    const str = String(sys || 'sys')
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
    }
    const s = colorList[Math.abs(hash) % colorList.length]
    return {
      color: s.color,
      background: s.background,
      borderColor: s.borderColor
    }
  }

  const Utils = {
    setNestedValue,
    getFieldValueOrType,
    buildGroupMockPayload,
    normalizeField,
    normalizeGroup,
    getSystemStyle
  }

  // 挂载到全局对象
  global.Utils = Utils
  global.setNestedValue = setNestedValue
  global.getFieldValueOrType = getFieldValueOrType
  global.buildGroupMockPayload = buildGroupMockPayload
  global.normalizeField = normalizeField
  global.normalizeGroup = normalizeGroup
  global.getSystemStyle = getSystemStyle
})(typeof window !== 'undefined' ? window : this)
