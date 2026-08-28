import { IRadioOption } from '../../interface/Radio'
import { VerticalAlign } from '../enum/VerticalAlign'

export const defaultRadioOption: Readonly<Required<IRadioOption>> = {
  width: 14,
  height: 14,
  gap: 5,
  lineWidth: 1,
  fillStyle: '#000000', // 选中填充色（Word 风格纯黑）
  strokeStyle: '#000000',
  verticalAlign: VerticalAlign.BOTTOM
}
