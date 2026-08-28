import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpClient, http, request } from '../../src/utils/request'

describe('轻量级网络请求工具方法测试', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('支持基本 GET 请求与 params 序列化', async () => {
    const mockData = { code: 200, data: { name: '张三' } }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const res = await http.get('/api/user', { id: 1001, status: 'active' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [callUrl, callInit] = fetchMock.mock.calls[0]
    expect(callUrl).toContain('/api/user?id=1001&status=active')
    expect(callInit?.method).toBe('GET')
    expect(res).toEqual(mockData)
  })

  it('支持 POST 请求并自动序列化 JSON 载荷', async () => {
    const payload = { title: '报告模板', content: '测试内容' }
    const mockResult = { success: true, id: 'RPT-123' }

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const res = await request('/api/report/save', {
      method: 'POST',
      data: payload
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, callInit] = fetchMock.mock.calls[0]
    expect(callInit?.body).toBe(JSON.stringify(payload))
    expect(res).toEqual(mockResult)
  })

  it('支持请求与响应拦截器', async () => {
    const client = new HttpClient({ baseURL: 'https://api.hospital.com' })
    client.addRequestInterceptor((url, options) => {
      return {
        url,
        options: {
          ...options,
          headers: {
            ...options.headers,
            Authorization: 'Bearer token_test_123'
          }
        }
      }
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await client.get('/v1/data')
    const [callUrl, callInit] = fetchMock.mock.calls[0]
    expect(callUrl).toBe('https://api.hospital.com/v1/data')
    expect((callInit?.headers as any)?.Authorization).toBe('Bearer token_test_123')
  })

  it('HTTP 状态码异常时正确抛出错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        statusText: 'Not Found'
      })
    )

    await expect(http.get('/api/not-found')).rejects.toThrow('HTTP Error 404: Not Found')
  })
})
