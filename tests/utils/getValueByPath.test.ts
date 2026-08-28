import { describe, expect, it } from 'vitest'
import { getValueByPath } from '../../src/editor/utils/index'

const data = {
  user: {
    age: 30,
    name: '张三'
  },
  records: [
    { itemName: '白细胞', value: 6.5 },
    { itemName: '红细胞', value: 4.2 }
  ],
  groups: [
    {
      title: 'A组',
      items: [{ id: 'a1' }, { id: 'a2' }]
    },
    {
      title: 'B组',
      items: [{ id: 'b1' }]
    }
  ]
}

describe('getValueByPath', () => {
  it('支持点号链式取值', () => {
    expect(getValueByPath(data, 'user.age')).toBe(30)
    expect(getValueByPath(data, 'user.name')).toBe('张三')
  })

  it('支持数组索引取值', () => {
    expect(getValueByPath(data, 'records[0].itemName')).toBe('白细胞')
    expect(getValueByPath(data, 'records[1].value')).toBe(4.2)
  })

  it('支持数组通配取值(返回数组)', () => {
    expect(getValueByPath(data, 'records[*].itemName')).toEqual([
      '白细胞',
      '红细胞'
    ])
  })

  it('支持多层嵌套与混合语法', () => {
    expect(getValueByPath(data, 'groups[0].items[1].id')).toBe('a2')
    expect(getValueByPath(data, 'groups[*].title')).toEqual(['A组', 'B组'])
    expect(getValueByPath(data, 'groups[*].items[*].id')).toEqual([
      'a1',
      'a2',
      'b1'
    ])
  })

  it('通配路径到数组本身时返回数组', () => {
    expect(getValueByPath(data, 'records[*]')).toEqual(data.records)
  })

  it('支持 $self 返回数据本身', () => {
    expect(getValueByPath(data, '$self')).toBe(data)
    expect(getValueByPath(data.records[0], '$self')).toBe(data.records[0])
  })

  it('路径不存在或中间节点为 null 时返回 undefined', () => {
    expect(getValueByPath(data, 'user.nonexist')).toBeUndefined()
    expect(getValueByPath(data, 'records[9].itemName')).toBeUndefined()
    expect(getValueByPath(null, 'user.age')).toBeUndefined()
    expect(getValueByPath(data, 'a.b.c')).toBeUndefined()
  })

  it('通配路径中部分元素缺字段时过滤 undefined', () => {
    const partial = {
      list: [{ name: 'x' }, {}, { name: 'z' }]
    }
    expect(getValueByPath(partial, 'list[*].name')).toEqual(['x', 'z'])
  })
})
