/**
 * 统一 REST API 客户端与接口服务
 */
;(function (global) {
  const API_BASE = global.API_BASE_URL || ''

  // 优先读取地址栏上的 appId 参数
  function getAppId() {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search)
      const urlAppId = urlParams.get('appId') || urlParams.get('appid')
      if (urlAppId) {
        return urlAppId
      }
    }
    return ''
  }

  // 优先读取地址栏上的 token 参数，没有就读取 cookie 的 Admin-Token
  function getAuthToken() {
    // 优先读取地址栏参数中的 token / Admin-Token
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search)
      const urlToken = urlParams.get('token') || getAppId()
      if (urlToken) {
        return urlToken
      }
    }

    // 读取 cookie 中的 Admin-Token
    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(/(^|;\s*)Admin-Token=([^;]*)/)
      if (match && match[2]) {
        return decodeURIComponent(match[2])
      }
    }


  }

  // 统一的 Element-UI 错误消息提示器
  function showErrorMessage(msg) {
    const displayMsg =
      typeof msg === 'object' ? JSON.stringify(msg) : String(msg)
    if (global.ELEMENT && global.ELEMENT.Message) {
      global.ELEMENT.Message.error(displayMsg)
    } else if (
      typeof global.Vue !== 'undefined' &&
      global.Vue.prototype &&
      global.Vue.prototype.$message
    ) {
      global.Vue.prototype.$message.error(displayMsg)
    } else {
      console.error('[API 错误]', displayMsg)
    }
  }

  async function apiRequest(url, options = {}) {
    const method = options.method || 'GET'
    let fullUrl = API_BASE + url
    const token = getAuthToken()
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {})
      }
    }
    if (options.params) {
      const query = new URLSearchParams(options.params).toString()
      if (query) fullUrl += (fullUrl.includes('?') ? '&' : '?') + query
    }
    if (options.data && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(options.data)
    }

    let response
    try {
      response = await fetch(fullUrl, fetchOptions)
    } catch (netErr) {
      const errMsg = `网络连接异常或接口未启动: ${netErr.message || netErr}`
      showErrorMessage(errMsg)
      throw netErr
    }

    let resData
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        resData = await response.json()
      } catch {
        resData = null
      }
    } else {
      resData = await response.text()
    }

    // 1. HTTP 状态码非 2xx 校验
    if (!response.ok) {
      const errorMsg =
        (resData &&
          typeof resData === 'object' &&
          (resData.msg || resData.message || resData.res)) ||
        (typeof resData === 'string' && resData) ||
        `HTTP ${response.status} ${response.statusText}`
      const displayMsg =
        typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : String(errorMsg)
      showErrorMessage(displayMsg)
      throw new Error(displayMsg)
    }

    // 2. 统一业务 code 校验：若 code 不是 200，则自动统一提示错误信息
    if (
      resData &&
      typeof resData === 'object' &&
      resData.code !== undefined &&
      resData.code !== 200
    ) {
      const errorMsg =
        resData.msg ||
        resData.message ||
        resData.res ||
        (typeof resData === 'string' ? resData : JSON.stringify(resData))
      const displayMsg =
        typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : String(errorMsg)
      showErrorMessage(displayMsg)
      throw new Error(displayMsg)
    }

    return resData
  }

  // 1. 系统列表 API 服务
  const systemApi = {
    listSystem: query =>
      apiRequest('/system/system/list', {
        method: 'GET',
        params: { pageNum: 1, pageSize: 1000, ...(query || {}) }
      })
  }

  // 2. 模板管理 API 服务
  const templateApi = {
    listSystem: systemApi.listSystem,
    listTemplate: query =>
      apiRequest('/system/report-template/list', {
        method: 'GET',
        params: query
      }),
    getTemplate: id =>
      apiRequest(`/system/report-template/${id}`, { method: 'GET' }),
    addTemplate: data =>
      apiRequest('/system/report-template', { method: 'POST', data }),
    updateTemplate: data =>
      apiRequest('/system/report-template', { method: 'PUT', data }),
    delTemplate: ids =>
      apiRequest(`/system/report-template/${ids}`, { method: 'DELETE' })
  }

  // 3. 组件字典与分组 API 服务
  const componentApi = {
    listSystem: systemApi.listSystem,
    listGroup: query =>
      apiRequest('/system/component-dictionary/group/list', {
        method: 'GET',
        params: query
      }),
    getGroup: id =>
      apiRequest(`/system/component-dictionary/group/${id}`, { method: 'GET' }),
    addGroup: data =>
      apiRequest('/system/component-dictionary/group', {
        method: 'POST',
        data
      }),
    updateGroup: data =>
      apiRequest('/system/component-dictionary/group', {
        method: 'PUT',
        data
      }),
    delGroup: ids =>
      apiRequest(`/system/component-dictionary/group/${ids}`, {
        method: 'DELETE'
      }),
    getFieldTree: id =>
      apiRequest(`/system/component-dictionary/group/${id}/field-tree`, {
        method: 'GET'
      }),
    getField: id =>
      apiRequest(`/system/component-dictionary/field/${id}`, { method: 'GET' }),
    addField: data =>
      apiRequest('/system/component-dictionary/field', {
        method: 'POST',
        data
      }),
    updateField: data =>
      apiRequest('/system/component-dictionary/field', {
        method: 'PUT',
        data
      }),
    delField: ids =>
      apiRequest(`/system/component-dictionary/field/${ids}`, {
        method: 'DELETE'
      })
  }

  // 挂载到全局
  global.API_BASE = API_BASE
  global.getAppId = getAppId
  global.getAuthToken = getAuthToken
  global.showErrorMessage = showErrorMessage
  global.apiRequest = apiRequest
  global.systemApi = systemApi
  global.templateApi = templateApi
  global.componentApi = componentApi
})(typeof window !== 'undefined' ? window : this)
