import { Context2d } from 'jspdf'
import { Pdf } from '..'
import { IEditorOption } from '../../editor'
import { DeepRequired } from '../../editor/interface/Common'

export class Header {

  private pdf: Pdf
  private options: DeepRequired<IEditorOption>

  constructor(pdf: Pdf) {
    this.pdf = pdf
    this.options = <DeepRequired<IEditorOption>>pdf.getOptions()
  }

  public render(ctx: Context2d) {
    const { header, width, margins } = this.options as any
    const data = header?.data
    const size = header?.size ?? 12
    const color = header?.color ?? '#000000'
    const font = header?.font ?? 'Microsoft YaHei'
    const headerTop = header?.top ?? margins?.[0] ?? 30
    if (!data) return
    ctx.save()
    ctx.fillStyle = color
    const style = ctx.font = `${size}px ${font}`
    // 文字长度
    const textWidth = this.pdf.measureText(style, data).width
    // 偏移量
    const left = (width - textWidth) / 2
    ctx.fillText(`${data}`, left < 0 ? 0 : left, headerTop)
    ctx.restore()
  }

}