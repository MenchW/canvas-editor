export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number // 毫秒，0 表示不自动关闭（常用于 loading）
}

const ICONS: Record<ToastType, string> = {
  success: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#52c41a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  `,
  error: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff4d4f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  `,
  warning: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#faad14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `,
  info: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1890ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  `,
  loading: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1890ff" stroke-width="2.5" stroke-linecap="round" style="animation: ce-toast-spin 0.8s linear infinite;">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  `
}

class ToastManager {
  private container: HTMLDivElement | null = null

  private initContainer() {
    if (this.container && document.body.contains(this.container)) return
    this.container = document.createElement('div')
    this.container.className = 'ce-toast-container'
    this.container.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `

    if (!document.getElementById('ce-toast-style')) {
      const style = document.createElement('style')
      style.id = 'ce-toast-style'
      style.textContent = `
        @keyframes ce-toast-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ce-toast-in {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes ce-toast-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(this.container)
  }

  public show(options: ToastOptions | string): () => void {
    if (typeof window === 'undefined') return () => {}
    this.initContainer()

    const config: ToastOptions = typeof options === 'string' ? { message: options, type: 'info' } : options
    const { message, type = 'info', duration = 2500 } = config

    const toastEl = document.createElement('div')
    toastEl.className = `ce-toast ce-toast--${type}`
    toastEl.style.cssText = `
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #ffffff;
      color: #333333;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.5;
      border-radius: 8px;
      box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
      animation: ce-toast-in 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      transition: all 0.25s;
    `

    const iconSpan = document.createElement('span')
    iconSpan.style.cssText = 'display: inline-flex; align-items: center; flex-shrink: 0;'
    iconSpan.innerHTML = ICONS[type] || ICONS.info

    const textSpan = document.createElement('span')
    textSpan.textContent = message
    textSpan.style.cssText = 'word-break: break-all;'

    toastEl.appendChild(iconSpan)
    toastEl.appendChild(textSpan)
    this.container!.appendChild(toastEl)

    let isClosed = false
    const close = () => {
      if (isClosed) return
      isClosed = true
      toastEl.style.animation = 'ce-toast-out 0.2s cubic-bezier(0.23, 1, 0.32, 1) forwards'
      setTimeout(() => {
        if (toastEl.parentNode) {
          toastEl.parentNode.removeChild(toastEl)
        }
      }, 200)
    }

    if (duration > 0) {
      setTimeout(close, duration)
    }

    return close
  }

  public success(message: string, duration = 2500) {
    return this.show({ message, type: 'success', duration })
  }

  public error(message: string, duration = 3000) {
    return this.show({ message, type: 'error', duration })
  }

  public warning(message: string, duration = 2500) {
    return this.show({ message, type: 'warning', duration })
  }

  public info(message: string, duration = 2500) {
    return this.show({ message, type: 'info', duration })
  }

  public loading(message: string, duration = 0) {
    return this.show({ message, type: 'loading', duration })
  }
}

export const toast = new ToastManager()
