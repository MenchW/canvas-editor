/**
 * 公共第三方依赖统一加载器 (本地静态 Vue 2 + Element UI)
 */
;(function () {
  // 获取当前 deps.js 所在目录的基准路径
  let basePath = './common/'
  const currentScript =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script')
      return scripts[scripts.length - 1]
    })()
  if (currentScript && currentScript.src) {
    basePath = currentScript.src.substring(
      0,
      currentScript.src.lastIndexOf('/') + 1
    )
  }

  const head = document.head || document.getElementsByTagName('head')[0]

  // 1. 注入本地 Element UI CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = basePath + 'lib/element-ui/theme-chalk/index.css'
  head.appendChild(link)

  // 2. 同步注入本地 Vue 与 Element-UI JS
  document.write('<script src="' + basePath + 'lib/vue/vue.js"><\/script>')
  document.write(
    '<script src="' + basePath + 'lib/element-ui/index.js"><\/script>'
  )
})()
