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

  it('直接调用不传参且无 getData 时：抛出异常错误', async () => {
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const mockControls = [
      { conceptId: 'name', placeholder: '姓名' }
    ]

    vi.spyOn(client, 'getControlList').mockResolvedValue(mockControls as any)

    await expect(client.getMissingControlList()).rejects.toThrow('缺少有效的 data 参数')
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

  it('支持手动传 { template, data } 对象筛选 miss 和 falseControls', async () => {
    const customTemplate = {
      data: {
        main: [
          { type: 'control', control: { conceptId: 'field_a', placeholder: '字段A' } },
          { type: 'control', control: { conceptId: 'field_b', placeholder: '字段B' } },
          { type: 'control', control: { conceptId: 'field_c', placeholder: '字段C' } }
        ]
      }
    }
    const customData = {
      field_a: '值有效',
      field_b: null // 假值
      // 缺少 field_c
    }

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const result = await client.getMissingControlList({
      template: customTemplate,
      data: customData
    })

    expect(result.missingControls.length).toBe(1)
    expect(result.missingControls[0].conceptId).toBe('field_c')
    expect(result.falsyControls.length).toBe(1)
    expect(result.falsyControls[0].conceptId).toBe('field_b')

    // 验证别名
    expect(result.missControls).toBe(result.missingControls)
    expect(result.falseControls).toBe(result.falsyControls)
  })

  it('支持手动传双参数 (template, data) 筛选', async () => {
    const customTemplate = [
      { type: 'control', control: { conceptId: 't1' } },
      { type: 'control', control: { conceptId: 't2' } }
    ]
    const customData = { t1: 'ok' }

    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const result = await client.getMissingControlList(customTemplate, customData)
    expect(result.missingControls.length).toBe(1)
    expect(result.missingControls[0].conceptId).toBe('t2')
    expect(result.falsyControls.length).toBe(0)
  })

  it('只传 template 时，data 自动回退找 getData；若无 getData 则抛出异常', async () => {
    const customTemplate = [
      { type: 'control', control: { conceptId: 'dept' } },
      { type: 'control', control: { conceptId: 'doc' } }
    ]

    // 1. 配置了 getData 时回退成功
    const clientWithData = new EditorClient({
      iframe: document.createElement('iframe'),
      getData: () => ({ dept: '内科', doc: '' }),
      onSave: vi.fn()
    })
    const res = await clientWithData.getMissingControlList({ template: customTemplate })
    expect(res.falsyControls.length).toBe(1)
    expect(res.falsyControls[0].conceptId).toBe('doc')

    // 2. 未配置 getData 时抛出异常
    const clientWithoutData = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })
    await expect(
      clientWithoutData.getMissingControlList({ template: customTemplate })
    ).rejects.toThrow('缺少有效的 data 参数')
  })

  it('只传 data 时，template 自动回退找 getTemplate；若无 getTemplate 则抛出异常', async () => {
    const customData = { username: 'admin' }

    // 1. 配置了 getTemplate 时回退成功
    const clientWithTpl = new EditorClient({
      iframe: document.createElement('iframe'),
      getTemplate: () => ({
        data: {
          main: [
            { type: 'control', control: { conceptId: 'username' } },
            { type: 'control', control: { conceptId: 'password' } }
          ]
        }
      }),
      onSave: vi.fn()
    })
    const res = await clientWithTpl.getMissingControlList(customData)
    expect(res.missingControls.length).toBe(1)
    expect(res.missingControls[0].conceptId).toBe('password')

    // 2. 未配置 getTemplate 时抛出异常
    const clientWithoutTpl = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })
    await expect(clientWithoutTpl.getMissingControlList(customData)).rejects.toThrow(
      '缺少有效的 template 参数'
    )
  })

  it('若 template 和 data 均未传且配置项中也均无，则抛出异常错误', async () => {
    const emptyClient = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })
    await expect(emptyClient.getMissingControlList()).rejects.toThrow(
      '缺少有效的 template 参数'
    )
    // 传空配置对象同样能正确触发校验抛错
    await expect(emptyClient.getMissingControlList({})).rejects.toThrow(
      '缺少有效的 template 参数'
    )
  })

  it('支持直接传入 template 数组（单参），data 自动回退找 getData', async () => {
    const templateArray = [
      { type: 'control', control: { conceptId: 'field1' } },
      { type: 'control', control: { conceptId: 'field2' } }
    ]
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      getData: () => ({ field1: '已填', field2: '' }),
      onSave: vi.fn()
    })

    const result = await client.getMissingControlList(templateArray)
    expect(result.missControls.length).toBe(0)
    expect(result.falseControls.length).toBe(1)
    expect(result.falseControls[0].conceptId).toBe('field2')
  })

  it('支持传入 (undefined, customData) 双参，template 自动从 options.getTemplate 获取', async () => {
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      getTemplate: () => [
        { type: 'control', control: { conceptId: 'dept' } },
        { type: 'control', control: { conceptId: 'doctor' } }
      ],
      onSave: vi.fn()
    })

    const result = await client.getMissingControlList(undefined, { dept: '呼吸科' })
    expect(result.missControls.length).toBe(1)
    expect(result.missControls[0].conceptId).toBe('doctor')
    expect(result.falseControls.length).toBe(0)
  })

  it('显式传了 template 且传了空数据对象 data: {} 时，所有控件均为 missControls', async () => {
    const template = [
      { type: 'control', control: { conceptId: 'itemA' } },
      { type: 'control', control: { conceptId: 'itemB' } }
    ]
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const result = await client.getMissingControlList({
      template,
      data: {}
    })
    expect(result.missControls.length).toBe(2)
    expect(result.missControls.map(c => c.conceptId)).toEqual(['itemA', 'itemB'])
    expect(result.falseControls.length).toBe(0)
  })

  it('显式传了无控件模板和数据时，正常返回空数组而不是抛出异常', async () => {
    const emptyTemplate = { main: [] }
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      onSave: vi.fn()
    })

    const result = await client.getMissingControlList(emptyTemplate, { foo: 'bar' })
    expect(result.missControls).toEqual([])
    expect(result.falseControls).toEqual([])
    expect(result.missingControls).toEqual([])
    expect(result.falsyControls).toEqual([])
  })

  it('支持在 config 中配置 header/footer/catalog 并在 setConfig 中动态下发更新', async () => {
    const client = new EditorClient({
      iframe: document.createElement('iframe'),
      config: {
        mode: 'readonly',
        header: false,
        footer: false,
        catalog: false,
        features: {
          header: false,
          footer: false,
          catalog: false
        }
      },
      onSave: vi.fn()
    })

    expect(client['options'].config?.header).toBe(false)
    expect(client['options'].config?.footer).toBe(false)
    expect(client['options'].config?.catalog).toBe(false)

    const setCustomConfigSpy = vi.fn()
    client['editorRpc'] = {
      setCustomConfig: setCustomConfigSpy
    } as any

    await client.setConfig({
      features: {
        catalog: true
      }
    })

    expect(setCustomConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({
          catalog: true
        })
      })
    )
  })
})

