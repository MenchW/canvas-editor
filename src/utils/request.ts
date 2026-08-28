export interface RequestOptions extends Omit<RequestInit, 'body'> {
  baseURL?: string
  params?: Record<string, any>
  data?: any
  timeout?: number // 超时时间(ms)，默认 15000
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
}

export interface RequestInterceptor {
  (url: string, options: RequestOptions): Promise<{ url: string; options: RequestOptions }> | { url: string; options: RequestOptions }
}

export interface ResponseInterceptor {
  (response: Response, options: RequestOptions): Promise<any> | any
}

class HttpClient {
  private baseURL: string
  private defaultTimeout: number
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []

  constructor(config: { baseURL?: string; timeout?: number } = {}) {
    this.baseURL = config.baseURL || ''
    this.defaultTimeout = config.timeout || 15000
  }

  /**
   * 添加请求拦截器
   */
  public addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor)
    return this
  }

  /**
   * 添加响应拦截器
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor)
    return this
  }

  /**
   * 拼接 query 参数到 URL
   */
  private buildURL(url: string, params?: Record<string, any>, baseURL?: string): string {
    let fullURL = url
    if (baseURL || this.baseURL) {
      const base = (baseURL || this.baseURL).replace(/\/+$/, '')
      const path = url.replace(/^\/+/, '')
      fullURL = `${base}/${path}`
    }

    if (!params) return fullURL

    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          val.forEach(item => searchParams.append(key, String(item)))
        } else if (typeof val === 'object') {
          searchParams.append(key, JSON.stringify(val))
        } else {
          searchParams.append(key, String(val))
        }
      }
    })

    const queryString = searchParams.toString()
    if (!queryString) return fullURL

    return fullURL.includes('?') ? `${fullURL}&${queryString}` : `${fullURL}?${queryString}`
  }

  /**
   * 发起通用网络请求
   */
  public async request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    let targetUrl = url
    let mergedOptions: RequestOptions = {
      timeout: this.defaultTimeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    // 执行请求拦截器
    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(targetUrl, mergedOptions)
      targetUrl = result.url
      mergedOptions = result.options
    }

    const finalUrl = this.buildURL(targetUrl, mergedOptions.params, mergedOptions.baseURL)

    // 构建 RequestInit
    const { timeout, data, responseType = 'json', ...fetchOptions } = mergedOptions
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    let body: BodyInit | undefined = undefined
    if (data !== undefined && data !== null) {
      if (typeof data === 'string' || data instanceof FormData || data instanceof Blob || data instanceof ArrayBuffer) {
        body = data
      } else {
        body = JSON.stringify(data)
      }
    }

    try {
      const response = await fetch(finalUrl, {
        ...fetchOptions,
        body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // 执行响应拦截器
      let processedResponse: any = response
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse, mergedOptions)
      }

      const isResponse =
        processedResponse &&
        (typeof processedResponse.text === 'function' ||
          (typeof Response !== 'undefined' && processedResponse instanceof Response))

      if (isResponse) {
        if (processedResponse.ok === false) {
          throw new Error(
            `HTTP Error ${processedResponse.status || 500}: ${processedResponse.statusText || 'Request Failed'}`
          )
        }

        switch (responseType) {
          case 'text':
            return (await processedResponse.text()) as unknown as T
          case 'blob':
            return (await processedResponse.blob()) as unknown as T
          case 'arraybuffer':
            return (await processedResponse.arrayBuffer()) as unknown as T
          case 'json':
          default: {
            const text = await processedResponse.text()
            try {
              return (text ? JSON.parse(text) : null) as T
            } catch {
              return text as unknown as T
            }
          }
        }
      }

      return processedResponse as T
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${finalUrl}`)
      }
      throw error
    }
  }

  public get<T = any>(url: string, params?: Record<string, any>, options?: Omit<RequestOptions, 'params' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET', params })
  }

  public post<T = any>(url: string, data?: any, options?: Omit<RequestOptions, 'data' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'POST', data })
  }

  public put<T = any>(url: string, data?: any, options?: Omit<RequestOptions, 'data' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PUT', data })
  }

  public delete<T = any>(url: string, params?: Record<string, any>, options?: Omit<RequestOptions, 'params' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE', params })
  }

  public patch<T = any>(url: string, data?: any, options?: Omit<RequestOptions, 'data' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PATCH', data })
  }
}

// 默认全局导出的单例与便捷实例
export const http = new HttpClient({
  baseURL: '', // 使用相对路径自动经由 Vite 代理服务器转发至后端，解决跨域问题
  timeout: 15000
})

// 便捷函数形式
export const request = <T = any>(url: string, options?: RequestOptions): Promise<T> => {
  return http.request<T>(url, options)
}

export { HttpClient }
