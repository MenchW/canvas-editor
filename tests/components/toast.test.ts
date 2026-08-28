import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from '../../src/components/toast'

describe('Toast 组件测试', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllTimers()
  })

  it('正确展示 success 类型的 Toast', () => {
    toast.success('保存成功！')
    const container = document.querySelector('.ce-toast-container')
    expect(container).not.toBeNull()

    const toastItem = container?.querySelector('.ce-toast--success')
    expect(toastItem).not.toBeNull()
    expect(toastItem?.textContent).toContain('保存成功！')
  })

  it('正确展示 error 类型的 Toast', () => {
    toast.error('保存失败，请检查网络')
    const toastItem = document.querySelector('.ce-toast--error')
    expect(toastItem).not.toBeNull()
    expect(toastItem?.textContent).toContain('保存失败，请检查网络')
  })

  it('loading 类型返回关闭回调函数', () => {
    const close = toast.loading('正在加载中...')
    const loadingToast = document.querySelector('.ce-toast--loading')
    expect(loadingToast).not.toBeNull()

    close()
    // 关闭动画已触发
    expect(loadingToast?.getAttribute('style')).toContain('ce-toast-out')
  })
})
