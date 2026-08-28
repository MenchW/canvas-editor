import type { IEditorOption } from '@/editor/interface/Editor'
import { EditorMode } from '@/editor/dataset/enum/Editor'

export function createOptions(override: Partial<IEditorOption> = {}): Partial<IEditorOption> {
  return {
    width: 794,
    height: 1123,
    margins: [100, 120, 100, 120],
    // 测试环境必须显式指定 EDIT 模式
    // mergeOption 的默认值是 EditorMode.READONLY，会导致所有写命令静默失败
    mode: EditorMode.EDIT,
    ...override
  }
}
