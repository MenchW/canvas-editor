import { describe, it, expect, vi } from 'vitest'
import { EditorClient } from '../../src/sdk/editor-client'

describe('EditorClient - getMissingControlList', () => {
  it('当控件列表包含宿主数据中缺失的字段时，返回 missingControls', async () => {
    const mockControls = [
      { conceptId: 'name', placeholder: '姓名' },
      { conceptId: 'age', placeholder: '年龄' },
      { conceptId: 'sex', placeholder: '性别' },
      { conceptId: 'className', placeholder: '班级' }
    ]

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    // Mock getControlList
    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    // 宿主数据只下发了 { name, age, sex }，缺少 className
    const hostData = {
      name: '张三',
      age: 18,
      sex: '男'
    }

    const result = await client.getMissingControlList(hostData)
    expect(result.missingControls.length).toBe(1)
    expect(result.missingControls[0].conceptId).toBe('className')
    expect(result.falsyControls.length).toBe(0)
  })

  it('当宿主数据字段多于或完全覆盖控件列表时，missingControls 为空数组 []', async () => {
    const mockControls = [
      { conceptId: 'name', placeholder: '姓名' },
      { conceptId: 'age', placeholder: '年龄' }
    ]

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    // 宿主数据下发了 { name, age, sex }（多了 sex）
    const hostData = {
      name: '张三',
      age: 18,
      sex: '男'
    }

    const result = await client.getMissingControlList(hostData)
    expect(result.missingControls).toEqual([])
    expect(result.falsyControls).toEqual([])
  })

  it('支持嵌套路径 (a.b.c) 的数据对齐匹配', async () => {
    const mockControls = [
      { conceptId: 'patient.name', placeholder: '患者姓名' },
      { conceptId: 'patient.age', placeholder: '患者年龄' },
      { conceptId: 'patient.gender', placeholder: '患者性别' }
    ]

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    // 宿主下发了嵌套结构对象，缺少 gender
    const hostData = {
      patient: {
        name: '李四',
        age: 20
      }
    }

    const result = await client.getMissingControlList(hostData)
    expect(result.missingControls.length).toBe(1)
    expect(result.missingControls[0].conceptId).toBe('patient.gender')
    expect(result.falsyControls.length).toBe(0)
  })

  it('正确识别 0 和 false 为合法非假值，其他 falsy 值归入 falsyControls', async () => {
    const mockControls = [
      { conceptId: 'hasHistory', placeholder: '既往史' },
      { conceptId: 'score', placeholder: '分值' },
      { conceptId: 'remark', placeholder: '备注' },
      { conceptId: 'avatar', placeholder: '头像' },
      { conceptId: 'tags', placeholder: '标签列表' }
    ]

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    const hostData = {
      hasHistory: false, // 属于合法值，非假值
      score: 0, // 属于合法值，非假值
      remark: '', // 空字符串 -> falsy
      avatar: null, // null -> falsy
      tags: [] // 空数组 -> falsy
    }

    const result = await client.getMissingControlList(hostData)
    expect(result.missingControls).toEqual([])
    // remark, avatar, tags 应该被识别为 falsyControls
    expect(result.falsyControls.length).toBe(3)
    const falsyConceptIds = result.falsyControls.map(c => c.conceptId)
    expect(falsyConceptIds).toContain('remark')
    expect(falsyConceptIds).toContain('avatar')
    expect(falsyConceptIds).toContain('tags')
    expect(falsyConceptIds).not.toContain('hasHistory')
    expect(falsyConceptIds).not.toContain('score')
  })

  it('直接调用不传参时：若未填充数据但配置了 getData，则自动调用 getData 进行数据比对', async () => {
    const mockGetData = vi.fn().mockReturnValue({
      name: '张三',
      age: 0
    })

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      getData: mockGetData,
      onSave: vi.fn()
    })

    const mockControls = [
      { conceptId: 'name', placeholder: '姓名' },
      { conceptId: 'age', placeholder: '年龄' },
      { conceptId: 'gender', placeholder: '性别' }
    ]

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    // 在未进行 setControlValueList 且未传参时调用
    const result = await client.getMissingControlList()

    // 应该触发 getData() 并识别出 missingControls: gender
    expect(mockGetData).toHaveBeenCalled()
    expect(result.missingControls.length).toBe(1)
    expect(result.missingControls[0].conceptId).toBe('gender')
    expect(result.falsyControls.length).toBe(0)
  })

  it('直接调用不传参且无 getData 时：返回空结果', async () => {
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const mockControls = [
      { conceptId: 'name', placeholder: '姓名' }
    ]

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    const result = await client.getMissingControlList()
    expect(result).toEqual({ missingControls: [], falsyControls: [] })
  })

  it('直接调用不传参时：若已填充数据，则自动比对已填充的业务数据', async () => {
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const mockControls = [
      { conceptId: 'name', placeholder: '姓名' },
      { conceptId: 'age', placeholder: '年龄' },
      { conceptId: 'className', placeholder: '班级' }
    ]

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    // Mock editorRpc.setControlValueList
    ;(client as any).editorRpc = {
      setControlValueList: vi.fn()
    }

    // 先通过 setControlValueList 填充数据
    await client.setControlValueList({
      name: '张三',
      age: 18
    })

    // 不传参直接调用
    const result = await client.getMissingControlList()

    // 应该比对上次填充的 { name, age }，返回缺失的 className
    expect(result.missingControls.length).toBe(1)
    expect(result.missingControls[0].conceptId).toBe('className')
  })

  it('无画布对象时，getControlList 自动从 getTemplate 提取顶层控件与表格本身（忽略表格内部tr/td）', async () => {
    const mockTemplate = {
      data: {
        header: [
          {
            type: 'control',
            control: { conceptId: 'hospital_title', placeholder: '医院名称' }
          }
        ],
        main: [
          {
            type: 'title',
            valueList: [
              {
                type: 'control',
                control: { conceptId: 'report_name', placeholder: '报告标题' }
              }
            ]
          },
          {
            value: '患者姓名：'
          },
          {
            type: 'control',
            control: { conceptId: 'patient_name', placeholder: '患者姓名' }
          },
          {
            type: 'table',
            conceptId: 'lab_table',
            name: '检测项目明细表',
            trList: [
              {
                loopConfig: {
                  datasetId: 'lab_table'
                },
                tdList: [
                  {
                    value: [
                      {
                        type: 'control',
                        control: { conceptId: 'table_cell_ctrl', placeholder: '表格内控件' }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    }

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      getTemplate: async () => mockTemplate,
      onSave: vi.fn()
    })

    // 未连接画布时调用
    const controls = await client.getControlList()

    // 应该提取顶层控件 hospital_title, report_name, patient_name，以及表格本身 lab_table，但忽略表格内部 table_cell_ctrl
    expect(controls.length).toBe(4)
    const conceptIds = controls.map(c => c.conceptId)
    expect(conceptIds).toContain('hospital_title')
    expect(conceptIds).toContain('report_name')
    expect(conceptIds).toContain('patient_name')
    expect(conceptIds).toContain('lab_table')
    expect(conceptIds).not.toContain('table_cell_ctrl')

    const tableCtrl = controls.find(c => c.conceptId === 'lab_table')
    expect(tableCtrl?.placeholder).toBe('检测项目明细表')
    expect(tableCtrl?.type).toBe('table')
  })

  it('无画布对象时，getMissingControlList 结合 getTemplate 和 getData 完整工作', async () => {
    const mockTemplate = {
      data: {
        main: [
          {
            type: 'control',
            control: { conceptId: 'patient_name', placeholder: '患者姓名' }
          },
          {
            type: 'control',
            control: { conceptId: 'age', placeholder: '年龄' }
          },
          {
            type: 'control',
            control: { conceptId: 'gender', placeholder: '性别' }
          }
        ]
      }
    }

    const mockData = {
      patient_name: '张三',
      age: '' // 假值
      // 缺少 gender
    }

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      getTemplate: () => mockTemplate,
      getData: () => mockData,
      onSave: vi.fn()
    })

    const auditResult = await client.getMissingControlList()
    expect(auditResult.missingControls.length).toBe(1)
    expect(auditResult.missingControls[0].conceptId).toBe('gender')
    expect(auditResult.falsyControls.length).toBe(1)
    expect(auditResult.falsyControls[0].conceptId).toBe('age')
  })
})
