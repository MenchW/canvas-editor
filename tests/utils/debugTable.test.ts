import { describe, it, expect } from 'vitest'
import { debugTableEcho } from '../../src/utils/debugTable'

describe('debugTableEcho 表格回显调试诊断工具', () => {
  it('正确分析正常匹配的单行循环表格并输出诊断指标', () => {
    const html = `<table width="100%" border="1">
      <thead><tr><th>项目</th><th>得分</th></tr></thead>
      <tbody>
        <tr loop="row in scoreList">
          <td>{{ row.name }}</td>
          <td>{{ row.score }}</td>
        </tr>
      </tbody>
    </table>`

    const mockData = {
      scoreList: [
        { name: '资质审核', score: 95 },
        { name: '卫生检查', score: 88 }
      ]
    }

    const result = debugTableEcho(html, mockData, { logToConsole: false })

    expect(result.success).toBe(true)
    expect(result.originalRows).toBe(2)
    expect(result.expandedRows).toBe(3) // 表头 1 + 2 行数据
    expect(result.declaredLoops.length).toBe(1)
    expect(result.declaredLoops[0].sourcePath).toBe('scoreList')
    expect(result.declaredLoops[0].matchedDataLength).toBe(2)
    expect(result.warnings.length).toBe(0)
  })

  it('在数据源路径写错时给出明确的定位与告警提示', () => {
    const html = `<table width="100%" border="1">
      <thead><tr><th>项目</th><th>得分</th></tr></thead>
      <tbody>
        <tr loop="row in wrongPathName">
          <td>{{ row.name }}</td>
          <td>{{ row.score }}</td>
        </tr>
      </tbody>
    </table>`

    const mockData = {
      actualDataList: [
        { name: '资质审核', score: 95 }
      ]
    }

    const result = debugTableEcho(html, mockData, { logToConsole: false })

    expect(result.declaredLoops[0].dataFound).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('wrongPathName')
    expect(result.warnings[0]).toContain('actualDataList')
  })
})
