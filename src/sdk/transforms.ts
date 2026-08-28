type MapperFn<T, R> = (item: T, index: number, array: T[]) => R

/**
 * 辅助函数：安全按路径提取对象深层属性（支持 'patient.name'、'info.picUrl' 等多层级路径）
 */
function getDeepVal(obj: any, path: string): any {
  if (!obj || !path) return undefined
  if (!path.includes('.')) return obj[path]
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj)
}

/**
 * 辅助函数：安全解析布尔勾选状态
 * 避免 JavaScript 原生 Boolean('false') === true / Boolean('0') === true 的经典通信 Bug
 */
function parseChecked(val: any): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val === 1
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'checked'
  }
  return Boolean(val)
}

/**
 * Canvas Editor 宿主数据转换适配工具集
 * 提供给宿主系统用于快捷将业务异构数据转换为 Canvas Editor 控件所期望的标准结构
 */
export const CanvasDataTransforms = {
  /**
   * 1. 分段文本转换器（List / List.Text）
   * 
   * @param data 原始数据（字符串数组、对象数组、单个字符串或包含换行符的文本块）
   * @param mapper 可选：自定义处理函数，或指定对象的取值键名（支持深层路径如 'user.name'）
   * 
   * @example
   * ```typescript
   * // 示例 1：纯字符串数组，无需传第二个参数
   * const list = ["发热3天", "伴有咳嗽"];
   * CanvasDataTransforms.list(list)

   * 
   * // 示例 2：按字段名快捷提取
   * const raw = [{ desc: "发热3天" }, { desc: "伴有咳嗽" }]
   * CanvasDataTransforms.list(raw, 'desc')
   * // => ["发热3天", "伴有咳嗽"]
   * 
   * // 示例 3：通过 Mapper 函数自定义序号、空格缩进或换行符
   * CanvasDataTransforms.list(raw, (item, idx) => `  ${idx + 1}. ${item.desc}\n`)
   * // => ["  1. 发热3天\n", "  2. 伴有咳嗽\n"]
   * 
   * // 示例 4：输入包含换行的多行大文本，自动分段
   * CanvasDataTransforms.list("1. 诊断一\n2. 诊断二")
   * // => ["1. 诊断一", "2. 诊断二"]
   * 
   * 
   * 
   * 
   * ```
   */
  list<T = any>(
    data: T[] | any,
    mapper?: MapperFn<T, string> | string
  ): string[] {
    if (data === null || data === undefined) return []

    // 若输入是含换行符的字符串，自动按行拆分为数组
    let list: any[]
    if (typeof data === 'string' && data.includes('\n')) {
      list = data.split(/\r?\n/)
    } else {
      list = Array.isArray(data) ? data : [data]
    }

    if (typeof mapper === 'function') {
      return list.map((item, idx) => String(mapper(item, idx, list) ?? ''))
    }

    if (typeof mapper === 'string') {
      return list.map(item => String(getDeepVal(item, mapper) ?? ''))
    }

    return list.map(item => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item !== null) {
        return String(
          item.value ?? item.text ?? item.label ?? item.content ?? ''
        )
      }
      return String(item)
    })
  },

  /**
   * 2. 图片/多图集合转换器（Images / List.Image）
   *
   * @param data 原始数据（图片 URL 数组、对象数组、单图 URL/对象、或逗号分隔的多图字符串）
   * @param mapper 可选：自定义处理函数，或指定图片链接字段名（支持深层路径如 'file.ossUrl'）
   *
   * @example
   * ```typescript
   * // 示例 1：纯 URL 数组或逗号隔开的字符串，无需传第二个参数
   * CanvasDataTransforms.images(["https://...1.png", "https://...2.png"])
   * CanvasDataTransforms.images("https://...1.png, https://...2.png")
   * // => [{ src: "https://...1.png" }, { src: "https://...2.png" }]
   *
   * // 示例 2：按字段名提取
   * const pics = [{ ossPath: "https://...1.png" }, { ossPath: "https://...2.png" }]
   * CanvasDataTransforms.images(pics, 'ossPath')
   * // => [{ src: "https://...1.png" }, { src: "https://...2.png" }]
   *
   * // 示例 3：通过 Mapper 函数自定义宽高
   * CanvasDataTransforms.images(pics, item => ({ src: item.ossPath, width: 120, height: 90 }))
   * // => [{ src: "https://...1.png", width: 120, height: 90 }, ...]
   * ```
   */
  images<T = any>(
    data: T[] | any,
    mapper?:
      | MapperFn<T, { src: string; width?: number; height?: number } | string>
      | string
  ): Array<{ src: string; width?: number; height?: number }> {
    if (data === null || data === undefined) return []

    // 若输入是逗号/分号分隔的图片 URL 串，自动解包为多图数组
    let list: any[]
    if (
      typeof data === 'string' &&
      (data.includes(',') || data.includes(';'))
    ) {
      list = data
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(Boolean)
    } else {
      list = Array.isArray(data) ? data : [data]
    }

    if (typeof mapper === 'function') {
      return list
        .map((item, idx) => {
          const res = mapper(item, idx, list)
          if (!res) return null
          return typeof res === 'string' ? { src: res } : res
        })
        .filter(
          (item): item is { src: string; width?: number; height?: number } =>
            Boolean(item && item.src)
        )
    }

    if (typeof mapper === 'string') {
      return list
        .map(item => ({ src: String(getDeepVal(item, mapper) ?? '') }))
        .filter(item => Boolean(item.src))
    }

    return list
      .map(item => {
        if (!item) return null
        if (typeof item === 'string') return { src: item }
        if (typeof item === 'object') {
          const src = String(
            item.src ?? item.url ?? item.fileUrl ?? item.path ?? ''
          )
          if (!src) return null
          return {
            src,
            ...(item.width !== undefined ? { width: item.width } : {}),
            ...(item.height !== undefined ? { height: item.height } : {})
          }
        }
        return null
      })
      .filter(
        (item): item is { src: string; width?: number; height?: number } =>
          Boolean(item && item.src)
      )
  },

  /**
   * 3. 选项类转换器（Checkbox / Radio / List.Radio / List.Checkbox / Select）
   *
   * @param data 原始数据（对象数组、选项数组、键值对等）
   * @param mapper 可选：自定义映射函数，或字段别名元组 ['labelKey', 'codeKey', 'checkedKey?']
   *
   * @example
   * ```typescript
   * // 示例 1：标准选项对象数组，无需传第二个参数
   * CanvasDataTransforms.options([{ label: "男", value: "1", checked: true }])
   * // => [{ label: "男", code: "1", checked: true }]
   *
   * // 示例 2：使用字段别名数组快速映射 ['labelKey', 'codeKey', 'checkedKey']
   * const list = [
   *   { diseaseName: "高血压", diseaseId: "D01", isSelected: "1" },
   *   { diseaseName: "糖尿病", diseaseId: "D02", isSelected: "0" }
   * ]
   * CanvasDataTransforms.options(list, ['diseaseName', 'diseaseId', 'isSelected'])
   * // => [
   * //   { label: "高血压", code: "D01", checked: true },
   * //   { label: "糖尿病", code: "D02", checked: false }
   * // ]
   *
   * // 示例 3：通过 Mapper 函数自定义组装
   * CanvasDataTransforms.options(list, item => ({
   *   label: item.diseaseName,
   *   code: item.diseaseId,
   *   checked: item.isSelected === '1'
   * }))
   * ```
   */
  options<T = any>(
    data: T[] | any,
    mapper?:
      | MapperFn<
          T,
          { label: string; code?: string; value?: string; checked?: boolean }
        >
      | [string, string, string?]
  ): Array<{
    label: string
    code?: string
    value?: string
    checked?: boolean
  }> {
    if (data === null || data === undefined) return []
    const list = (Array.isArray(data) ? data : [data]).filter(
      item => item !== null && item !== undefined
    )

    if (typeof mapper === 'function') {
      return list.map((item, idx) => mapper(item, idx, list))
    }

    if (Array.isArray(mapper)) {
      const [labelKey, codeKey, checkedKey] = mapper
      return list.map((item, idx) => ({
        label: String(getDeepVal(item, labelKey) ?? ''),
        code: codeKey ? String(getDeepVal(item, codeKey) ?? '') : String(idx),
        ...(checkedKey
          ? { checked: parseChecked(getDeepVal(item, checkedKey)) }
          : {})
      }))
    }

    return list.map((item, idx) => {
      if (typeof item === 'string') {
        return { label: item, code: String(idx) }
      }
      return {
        label: String(item.label ?? item.name ?? item.text ?? ''),
        code: String(item.code ?? item.value ?? item.id ?? idx),
        ...(item.checked !== undefined
          ? { checked: parseChecked(item.checked) }
          : {})
      }
    })
  }
}
