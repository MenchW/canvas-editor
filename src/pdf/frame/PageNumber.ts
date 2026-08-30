import { Context2d } from 'jspdf'
import { Pdf } from '..'
import { IEditorOption } from '../../editor'
import { DeepRequired } from '../../editor/interface/Common'

export class PageNumber {

  private options: DeepRequired<IEditorOption>

  constructor(pdf: Pdf) {
    this.options = <DeepRequired<IEditorOption>>pdf.getOptions()
  }

  public render(ctx: Context2d, pageNo: number) {
    const { pageNumber, scale, width, height } = this.options
    const size = pageNumber?.size ?? 12
    const font = pageNumber?.font ?? 'Microsoft YaHei'
    const bottom = pageNumber?.bottom ?? 60
    ctx.save()
    ctx.fillStyle = '#000000'
    ctx.font = `${size * scale}px ${font}`
    ctx.fillText(`${pageNo + 1}`, width / 2, height - bottom)
    ctx.restore()
  }

}