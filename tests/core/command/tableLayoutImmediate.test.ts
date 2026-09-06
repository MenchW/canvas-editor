import { describe, it, expect } from 'vitest'
import { RowFlex } from '../../../src/editor/dataset/enum/Row'
import { ListType, ListStyle } from '../../../src/editor/dataset/enum/List'
import { getTdFingerprint } from '../../../src/editor/core/draw/Draw'

describe('单元格排版与工具栏即时生效测试', () => {
  it('单元格排版属性（rowFlex）变化时，getTdFingerprint 产生不同指纹使缓存即时失效', () => {
    const td: any = {
      value: [{ value: '文本内容', size: 16 }],
      verticalAlign: 'top'
    }
    const tr: any = { height: 40, minHeight: 30 }
    const baseFp = getTdFingerprint(td, undefined, tr)

    // 设置居中排版 rowFlex 后指纹改变
    td.value[0].rowFlex = RowFlex.CENTER
    const centerFp = getTdFingerprint(td, undefined, tr)
    expect(centerFp).not.toBe(baseFp)

    // 设置两端对齐
    td.value[0].rowFlex = RowFlex.ALIGNMENT
    const alignFp = getTdFingerprint(td, undefined, tr)
    expect(alignFp).not.toBe(centerFp)
  })

  it('单元格列表属性（listType/listStyle）变化时，getTdFingerprint 产生不同指纹使缓存即时失效', () => {
    const td: any = {
      value: [{ value: '列表内容', size: 16 }],
      verticalAlign: 'top'
    }
    const tr: any = { height: 40, minHeight: 30 }
    const baseFp = getTdFingerprint(td, undefined, tr)

    // 设置有序列表
    td.value[0].listType = ListType.OL
    td.value[0].listStyle = ListStyle.DECIMAL
    const olFp = getTdFingerprint(td, undefined, tr)
    expect(olFp).not.toBe(baseFp)

    // 设置无序列表
    td.value[0].listType = ListType.UL
    td.value[0].listStyle = ListStyle.DISC
    const ulFp = getTdFingerprint(td, undefined, tr)
    expect(ulFp).not.toBe(olFp)
  })

  it('单元格行间距与行高（rowMargin/tr.height）变化时，getTdFingerprint 产生不同指纹', () => {
    const td: any = {
      value: [{ value: '行高测试', size: 16 }],
      verticalAlign: 'top'
    }
    const tr: any = { height: 40, minHeight: 30 }
    const baseFp = getTdFingerprint(td, undefined, tr)

    // 设置行间距 rowMargin
    td.value[0].rowMargin = 2
    const marginFp = getTdFingerprint(td, undefined, tr)
    expect(marginFp).not.toBe(baseFp)

    // 设置行高 tr.height
    tr.height = 80
    const heightFp = getTdFingerprint(td, undefined, tr)
    expect(heightFp).not.toBe(marginFp)

    // 设置单元格垂直居中
    td.verticalAlign = 'middle'
    const vAlignFp = getTdFingerprint(td, undefined, tr)
    expect(vAlignFp).not.toBe(heightFp)
  })
})
