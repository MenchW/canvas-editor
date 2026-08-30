import { Context2d } from 'jspdf'
import { Pdf } from '..'
import { IEditorOption } from '../../editor'
import { DeepRequired } from '../../editor/interface/Common'
import { IRowElement } from '../../editor/interface/Row'

export class CheckboxParticle {

  private options: DeepRequired<IEditorOption>

  constructor(pdf: Pdf) {
    this.options = pdf.getOptions()
  }

  public render(ctx: Context2d, element: IRowElement, x: number, y: number) {
    const checkboxOpt = (this.options.checkbox || {}) as any
    const gap = checkboxOpt.gap ?? 0
    const lineWidth = checkboxOpt.lineWidth ?? 1
    const fillStyle = checkboxOpt.fillStyle ?? '#000000'
    const fontStyle = checkboxOpt.fontStyle ?? checkboxOpt.checkMarkColor ?? '#ffffff'
    const scale = this.options.scale ?? 1
    const { metrics, checkbox } = element
    // left top 四舍五入避免1像素问题
    const left = Math.round(x + gap)
    const top = Math.round(y - metrics.height + lineWidth)
    const width = metrics.width - gap * 2 * scale
    const height = metrics.height
    ctx.save()
    ctx.beginPath()
    ctx.translate(0.5, 0.5)
    // 绘制勾选状态
    if (checkbox?.value) {
      // 边框
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = fillStyle
      ctx.rect(left, top, width, height)
      ctx.stroke()
      // 背景色
      ctx.beginPath()
      ctx.fillStyle = fillStyle
      ctx.fillRect(left, top, width, height)
      // 勾选对号
      ctx.beginPath()
      ctx.strokeStyle = fontStyle
      ctx.lineWidth = lineWidth * 2
      ctx.moveTo(left + 2 * scale, top + 7 * scale)
      ctx.lineTo(left + 7 * scale, top + 11 * scale)
      ctx.moveTo(left + 6.5 * scale, top + 11 * scale)
      ctx.lineTo(left + 12 * scale, top + 3 * scale)
      ctx.stroke()
    } else {
      ctx.lineWidth = lineWidth
      ctx.rect(left, top, width, height)
      ctx.stroke()
    }
    ctx.closePath()
    ctx.restore()
  }

}