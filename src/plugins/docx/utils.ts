export function saveAs(blob: Blob, name: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  try {
    a.click()
  } catch (e) {
    console.warn('[saveAs] 导出word失败:', e)
    const newWin = window.open(url, '_blank')
    if (!newWin) {
      console.warn(
        '【宿主沙箱提示】受系统 iframe 安全限制未能直接弹出文件保存。请在宿主 <iframe sandbox="..."> 标签中添加 allow-downloads 许可。'
      )
    }
  }
  setTimeout(() => {
    window.URL.revokeObjectURL(url)
  }, 1000)
}
