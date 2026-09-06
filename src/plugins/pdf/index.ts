import { jsPDF } from 'jspdf'
import Editor, { EditorMode, PaperDirection } from '../../editor'
import { toast } from '../../components/toast/Toast'

export interface IExportPdfOption {
  fileName?: string
  imageQuality?: number
}

declare module '../../editor' {
  interface Command {
    executeExportPdf(payload?: IExportPdfOption | string): Promise<void> | void
  }
}

export function exportPdf(editor: Editor) {
  return async function (payload: IExportPdfOption | string = '导出文档') {
    const fileName =
      typeof payload === 'string' ? payload : payload.fileName || '导出文档'
    const imageQuality =
      typeof payload === 'object' && payload.imageQuality
        ? payload.imageQuality
        : 0.88

    const closeToast = toast.loading('正在导出 PDF 文档，请稍候...')
    const command = editor.command
    const options = command.getOptions()
    const { scale, printPixelRatio, paperDirection } = options

    try {
      if (scale !== 1) {
        command.executePageScale(1)
      }

      const base64List = await command.getImage({
        pixelRatio: printPixelRatio,
        mode: EditorMode.PRINT,
        imageType: 'image/jpeg',
        imageQuality
      })

      if (!base64List || !base64List.length) {
        if (scale !== 1) {
          command.executePageScale(scale)
        }
        toast.warning('未获取到可导出的页面内容')
        return
      }

      const isHorizontal = paperDirection === PaperDirection.HORIZONTAL

      const doc = new jsPDF({
        orientation: isHorizontal ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      })

      const pdfWidth = doc.internal.pageSize.getWidth()
      const pdfHeight = doc.internal.pageSize.getHeight()

      base64List.forEach((imgData: string, index: number) => {
        if (index > 0) {
          doc.addPage()
        }
        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
      })

      if (scale !== 1) {
        command.executePageScale(scale)
      }

      try {
        doc.save(`${fileName}.pdf`)
      } catch (e) {
        console.warn('[exportPdfPlugin] 原生下载限制:', e)
        const blob = doc.output('blob')
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileName}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }

      toast.success('PDF 导出成功')
    } catch (err: any) {
      console.error('[exportPdfPlugin] 导出 PDF 失败:', err)
      toast.error(`导出 PDF 失败: ${err?.message || '未知错误'}`)
      if (scale !== 1) {
        command.executePageScale(scale)
      }
    } finally {
      closeToast()
    }
  }
}

export default function pdfPlugin(editor: Editor) {
  const command = editor.command
  command.executeExportPdf = exportPdf(editor)
}
