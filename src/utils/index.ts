import { getUUID, splitText } from '../editor/utils'

export function debounce<T extends unknown[]>(
  func: (...arg: T) => unknown,
  delay: number
) {
  let timer: number
  return function (this: unknown, ...args: T) {
    if (timer) {
      window.clearTimeout(timer)
    }
    timer = window.setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

export function scrollIntoView(container: HTMLElement, selected: HTMLElement) {
  if (!selected) {
    container.scrollTop = 0
    return
  }
  const offsetParents: HTMLElement[] = []
  let pointer = <HTMLElement>selected.offsetParent
  while (pointer && container !== pointer && container.contains(pointer)) {
    offsetParents.push(pointer)
    pointer = <HTMLElement>pointer.offsetParent
  }
  const top =
    selected.offsetTop +
    offsetParents.reduce((prev, curr) => prev + curr.offsetTop, 0)
  const bottom = top + selected.offsetHeight
  const viewRectTop = container.scrollTop
  const viewRectBottom = viewRectTop + container.clientHeight
  if (top < viewRectTop) {
    container.scrollTop = top
  } else if (bottom > viewRectBottom) {
    container.scrollTop = bottom - container.clientHeight
  }
}

export function nextTick(fn: Function) {
  const callback = window.requestIdleCallback || window.setTimeout
  callback(() => {
    fn()
  })
}

/**
 * 辅助函数：统一绑定 DOM 元素的拖拽数据与传输格式
 */
export function bindDragData(
  el: HTMLElement,
  getPayload: () => Record<string, any>
) {
  el.draggable = true
  el.ondragstart = (e: DragEvent) => {
    const data = getPayload()
    const dataStr = JSON.stringify(data)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('application/json', dataStr)
      e.dataTransfer.setData('text/plain', dataStr)
    }
  }
}

/**
 * 辅助函数：清理占位符多余花括号，保证由渲染引擎统一渲染
 */
export function sanitizePlaceholderText(text: any): string {
  if (typeof text !== 'string') return text || ''
  return text
    .replace(/^\{\{\s*/, '')
    .replace(/\s*\}\}$/, '')
    .trim()
}

/**
 * 辅助函数：清洗表格 trList 内控件的 placeholder
 */
export function sanitizeTrList(trList: any[]): any[] {
  if (!Array.isArray(trList)) return trList
  return trList.map(tr => {
    const newTr = { ...tr }
    if (Array.isArray(tr.tdList)) {
      newTr.tdList = tr.tdList.map((td: any) => {
        const newTd = { ...td }
        if (Array.isArray(td.value)) {
          newTd.value = td.value.map((v: any) => {
            if (v && v.control && typeof v.control.placeholder === 'string') {
              return {
                ...v,
                control: {
                  ...v.control,
                  placeholder: sanitizePlaceholderText(v.control.placeholder)
                }
              }
            }
            return v
          })
        }
        return newTd
      })
    }
    return newTr
  })
}

function parseCellSpan(cell: Element, attr: string): number {
  const val = parseInt(cell.getAttribute(attr) || '1', 10)
  return !isNaN(val) && val > 0 ? val : 1
}

function parseCssStyle(str: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!str) return map
  str.split(';').forEach(pair => {
    const i = pair.indexOf(':')
    if (i > 0) {
      map[pair.slice(0, i).trim().toLowerCase()] = pair.slice(i + 1).trim()
    }
  })
  return map
}

function parseMergeSame(
  cell: Element
): 'vertical' | 'horizontal' | 'both' | undefined {
  if (!cell.hasAttribute('merge-same') && !cell.hasAttribute('mergesame')) {
    return undefined
  }
  const attr = (
    cell.getAttribute('merge-same') ||
    cell.getAttribute('mergesame') ||
    ''
  )
    .trim()
    .toLowerCase()
  if (attr === 'horizontal' || attr === 'both') return attr
  return 'vertical'
}

function parseCellChildNodesToValueList(
  node: Node,
  inheritedStyle: {
    isBold?: boolean
    textColor?: string
    customSize?: number
    isItalic?: boolean
    isUnderline?: boolean
    rowFlex?: string
    when?: string
  },
  options: {
    loopItemAlias?: string
    parentAlias?: string
  }
): any[] {
  const result: any[] = []

  if (node.nodeType === Node.TEXT_NODE) {
    let rawText = node.textContent || ''
    if (!rawText) return result

    // 清理 HTML 模板源码换行格式化产生的首尾多余换行与多余缩进空格
    rawText = rawText.replace(/^\s*\n\s*/, '').replace(/\n\s*$/, '')
    rawText = rawText.replace(/[ \t]+/g, ' ')
    if (!rawText) return result

    const placeholderRegex = /\{\{\s*([\w\.\-]+)\s*\}\}/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = placeholderRegex.exec(rawText)) !== null) {
      const textBefore = rawText.slice(lastIndex, match.index)
      if (textBefore) {
        splitText(textBefore).forEach(c => {
          result.push({
            value: c,
            bold: inheritedStyle.isBold || undefined,
            color: inheritedStyle.textColor,
            size: inheritedStyle.customSize,
            italic: inheritedStyle.isItalic || undefined,
            underline: inheritedStyle.isUnderline || undefined,
            rowFlex: inheritedStyle.rowFlex as any,
            when: inheritedStyle.when
          })
        })
      }

      const fullKey = match[1]
      let cleanKey = fullKey
      if (
        options.loopItemAlias &&
        cleanKey.startsWith(options.loopItemAlias + '.')
      ) {
        cleanKey = cleanKey.slice(options.loopItemAlias.length + 1)
      } else if (
        options.parentAlias &&
        cleanKey.startsWith(options.parentAlias + '.')
      ) {
        cleanKey = cleanKey.slice(options.parentAlias.length + 1)
      }

      const lowerKey = cleanKey.toLowerCase()
      const isLikelyImage =
        lowerKey.includes('image') ||
        lowerKey.includes('photo') ||
        lowerKey.includes('pic') ||
        lowerKey.includes('avatar')

      result.push({
        type: 'control',
        value: '',
        controlId: getUUID(),
        rowFlex: inheritedStyle.rowFlex as any,
        when: inheritedStyle.when,
        control: {
          type: isLikelyImage ? 'image' : 'text',
          conceptId: cleanKey,
          placeholder: fullKey,
          when: inheritedStyle.when
        }
      })

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < rawText.length) {
      const textAfter = rawText.slice(lastIndex)
      if (textAfter) {
        splitText(textAfter).forEach(c => {
          result.push({
            value: c,
            bold: inheritedStyle.isBold || undefined,
            color: inheritedStyle.textColor,
            size: inheritedStyle.customSize,
            italic: inheritedStyle.isItalic || undefined,
            underline: inheritedStyle.isUnderline || undefined,
            rowFlex: inheritedStyle.rowFlex as any,
            when: inheritedStyle.when
          })
        })
      }
    }
  } else if (
    node.nodeType === Node.ELEMENT_NODE ||
    (node as any).nodeType === 1
  ) {
    const el = node as HTMLElement
    const nodeCss = parseCssStyle(el.getAttribute('style') || '')
    const nodeWhen = el.getAttribute('when') || inheritedStyle.when
    const tagName = el.tagName.toLowerCase()

    const isBold =
      inheritedStyle.isBold ||
      tagName === 'b' ||
      tagName === 'strong' ||
      nodeCss['font-weight'] === 'bold' ||
      parseInt(nodeCss['font-weight'] || '400', 10) >= 700
    const isItalic =
      inheritedStyle.isItalic ||
      tagName === 'i' ||
      tagName === 'em' ||
      nodeCss['font-style'] === 'italic'
    const isUnderline =
      inheritedStyle.isUnderline ||
      tagName === 'u' ||
      (nodeCss['text-decoration'] || '').includes('underline')
    const textColor = nodeCss['color'] || inheritedStyle.textColor
    const fontSizeStr = nodeCss['font-size'] || ''
    const customSize = fontSizeStr
      ? parseInt(fontSizeStr, 10)
      : inheritedStyle.customSize

    const childStyle = {
      isBold,
      isItalic,
      isUnderline,
      textColor,
      customSize,
      rowFlex: inheritedStyle.rowFlex,
      when: nodeWhen
    }

    if (tagName === 'input') {
      const inputType = (el.getAttribute('type') || 'text').toLowerCase()
      if (inputType === 'checkbox') {
        const isChecked =
          el.hasAttribute('checked') || (el as HTMLInputElement).checked
        result.push({
          type: 'checkbox',
          value: '',
          checkbox: {
            value: isChecked
          }
        })
        return result
      } else if (inputType === 'radio') {
        const isChecked =
          el.hasAttribute('checked') || (el as HTMLInputElement).checked
        result.push({
          type: 'radio',
          value: '',
          radio: {
            value: isChecked
          }
        })
        return result
      }
    } else if (tagName === 'img') {
      const srcAttr = (el.getAttribute('src') || '').trim()
      const widthAttr = el.getAttribute('width') || nodeCss['width'] || ''
      const heightAttr = el.getAttribute('height') || nodeCss['height'] || ''
      const imgWidth = widthAttr ? parseInt(widthAttr, 10) : 120
      const imgHeight = heightAttr ? parseInt(heightAttr, 10) : 80

      // 判断 src 是否是动态占位符，如 {{ rule }} 或 {{ item.picUrl }}
      const placeholderMatch = srcAttr.match(/^\{\{\s*([\w\.\-]+)\s*\}\}$/)
      if (placeholderMatch) {
        const fullKey = placeholderMatch[1]
        let cleanKey = fullKey
        if (
          options.loopItemAlias &&
          cleanKey.startsWith(options.loopItemAlias + '.')
        ) {
          cleanKey = cleanKey.slice(options.loopItemAlias.length + 1)
        } else if (
          options.parentAlias &&
          cleanKey.startsWith(options.parentAlias + '.')
        ) {
          cleanKey = cleanKey.slice(options.parentAlias.length + 1)
        }
        result.push({
          type: 'control',
          value: '',
          controlId: getUUID(),
          rowFlex: inheritedStyle.rowFlex as any,
          when: inheritedStyle.when,
          control: {
            type: 'image',
            conceptId: cleanKey,
            placeholder: fullKey,
            width: imgWidth,
            height: imgHeight,
            when: inheritedStyle.when
          }
        })
      } else if (srcAttr) {
        // 静态图片
        result.push({
          type: 'image',
          value: srcAttr,
          width: imgWidth,
          height: imgHeight,
          rowFlex: inheritedStyle.rowFlex as any,
          when: inheritedStyle.when
        })
      }
      return result
    }

    const elLoop = el.getAttribute('loop')
    let innerLoopConfig: any = undefined
    let childOptions = options

    if (elLoop) {
      let loopItemAlias = 'item'
      let loopDataKey = ''
      const match = elLoop.match(/(?:let|var|const)?\s*(\w+)\s+in\s+([\w\.]+)/)
      if (match) {
        loopItemAlias = match[1]
        loopDataKey = match[2]
      } else {
        loopDataKey = elLoop.trim()
      }
      innerLoopConfig = {
        isLoop: true,
        datasetId: loopDataKey,
        itemAlias: loopItemAlias,
        isBlock: tagName === 'div' || tagName === 'p' || tagName === 'li' || tagName === 'tr'
      }
      childOptions = {
        ...options,
        parentAlias: options.loopItemAlias || options.parentAlias,
        loopItemAlias: loopItemAlias
      }
    }

    const children = Array.from(el.childNodes)
    const childNodesResult: any[] = []

    if (children.length === 0 && el.textContent) {
      // 兼容一些自闭合或无 childNodes 元素
      childNodesResult.push(
        ...parseCellChildNodesToValueList(
          document.createTextNode(el.textContent),
          childStyle,
          childOptions
        )
      )
    } else {
      children.forEach(child => {
        childNodesResult.push(
          ...parseCellChildNodesToValueList(child, childStyle, childOptions)
        )
      })
    }

    if (innerLoopConfig && childNodesResult.length > 0) {
      const loopBlockId = getUUID()
      childNodesResult.forEach(nodeItem => {
        nodeItem.innerLoop = {
          ...innerLoopConfig,
          loopBlockId
        }
      })
    }

    result.push(...childNodesResult)
  }

  return result
}

/**
 * 通用 HTML 表格模板解析器 (从 HTML 解析为标准 Canvas-Editor Table Element)
 * 纯粹通用，无特定业务硬编码，完整支持 loop、colspan、rowspan、align、bgcolor 与任意占位符 { field }
 */
export function parseTableHtml(
  html: string,
  options?: {
    defaultConceptId?: string
    name?: string
    availableWidth?: number
    pagingRepeat?: boolean
  }
): any {
  if (!html || typeof html !== 'string') return null
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const tableEl = doc.querySelector('table')
    if (!tableEl) return null

    const trEls = Array.from(tableEl.querySelectorAll('tr'))
    if (!trEls.length) return null

    let maxCols = 1

    let conceptId =
      options?.defaultConceptId ||
      tableEl.getAttribute('conceptid') ||
      tableEl.getAttribute('conceptId') ||
      ''

    const trList = trEls.map((tr, rIdx) => {
      const parentTbody = tr.closest('tbody')
      const parentThead = tr.closest('thead')
      const tbodyLoop = parentTbody ? parentTbody.getAttribute('loop') : null
      const trLoop = tr.getAttribute('loop')

      let loopConfig: any = undefined
      let loopItemAlias = ''
      let loopDataKey = ''
      let parentAlias = ''
      let parentDataKey = ''

      if (tbodyLoop) {
        const match = tbodyLoop.match(
          /(?:let|var|const)?\s*(\w+)\s+in\s+([\w\.]+)/
        )
        if (match) {
          parentAlias = match[1]
          parentDataKey = match[2]
        } else {
          parentDataKey = tbodyLoop.trim()
        }
        if (!conceptId) conceptId = parentDataKey
      }

      if (trLoop) {
        const match = trLoop.match(
          /(?:let|var|const)?\s*(\w+)\s+in\s+([\w\.]+)/
        )
        if (match) {
          loopItemAlias = match[1]
          loopDataKey = match[2]
        } else {
          loopDataKey = trLoop.trim()
        }
        let effectiveDatasetId = loopDataKey
        if (parentAlias && effectiveDatasetId.startsWith(parentAlias + '.')) {
          effectiveDatasetId = effectiveDatasetId.slice(parentAlias.length + 1)
        }
        loopConfig = {
          isLoopRow: true,
          datasetId: effectiveDatasetId,
          isDetailRow: Boolean(tbodyLoop),
          itemAlias: loopItemAlias,
          sourcePath: loopDataKey
        }
        if (!conceptId) conceptId = loopDataKey
      }

      if (tbodyLoop) {
        const tbodyTrs = Array.from(parentTbody!.querySelectorAll('tr'))
        const isFirstTrInTbody = tbodyTrs[0] === tr
        if (isFirstTrInTbody) {
          const lastTrInTbody = tbodyTrs[tbodyTrs.length - 1]
          const lastTrIndexInTable = trEls.indexOf(lastTrInTbody)
          loopConfig = {
            ...(loopConfig || {}),
            isLoopRow: true,
            datasetId: parentDataKey,
            endTrIndex: lastTrIndexInTable,
            isTbodyGroup: true
          }
        }
      }

      const isHeader =
        rIdx === 0 || parentThead !== null || tr.querySelector('th') !== null

      const cellEls = Array.from(tr.querySelectorAll('th, td'))
      let rowCols = 0
      let maxCellHeight = 0
      const trCss = parseCssStyle(tr.getAttribute('style') || '')

      const effectiveAlias = loopItemAlias || parentAlias

      const tdList = cellEls.map(cell => {
        const colspan = parseCellSpan(cell, 'colspan')
        const rowspan = parseCellSpan(cell, 'rowspan')
        rowCols += colspan

        const mergeSame = parseMergeSame(cell)
        const cellCss = parseCssStyle(cell.getAttribute('style') || '')

        const isCellHeader = cell.tagName.toLowerCase() === 'th'
        const rawAlign =
          cellCss['text-align'] ||
          cell.getAttribute('align') ||
          trCss['text-align'] ||
          tr.getAttribute('align') ||
          (isCellHeader ? 'center' : undefined)
        const rowFlex = rawAlign === 'justify' ? 'alignment' : rawAlign

        const bgColor =
          cellCss['background-color'] ||
          cellCss['background'] ||
          cell.getAttribute('bgcolor') ||
          trCss['background-color'] ||
          trCss['background'] ||
          tr.getAttribute('bgcolor') ||
          undefined
        const verticalAlign =
          ((cellCss['vertical-align'] || cell.getAttribute('valign')) as any) ||
          undefined
        const textColor = cellCss['color'] || undefined
        const fontSizeStr = cellCss['font-size'] || ''
        const customSize = fontSizeStr ? parseInt(fontSizeStr, 10) : undefined
        const isItalic =
          cellCss['font-style'] === 'italic' ||
          cell.querySelector('i, em') !== null
        const isUnderline =
          (cellCss['text-decoration'] || '').includes('underline') ||
          cell.querySelector('u') !== null
        const whenAttr = cell.getAttribute('when') || undefined

        const cellHeightStr =
          cellCss['height'] || cell.getAttribute('height') || ''
        const customCellHeight = cellHeightStr
          ? parseInt(cellHeightStr, 10)
          : undefined
        if (customCellHeight && customCellHeight > maxCellHeight) {
          maxCellHeight = customCellHeight
        }

        const isBold =
          isCellHeader ||
          cellCss['font-weight'] === 'bold' ||
          cell.querySelector('b, strong') !== null ||
          trCss['font-weight'] === 'bold' ||
          tr.querySelector('b, strong') !== null

        const valueList: any[] = parseCellChildNodesToValueList(
          cell,
          {
            isBold,
            isItalic,
            isUnderline,
            textColor,
            customSize,
            rowFlex: rowFlex as any,
            when: whenAttr
          },
          {
            loopItemAlias: effectiveAlias,
            parentAlias
          }
        )

        if (valueList.length === 0) {
          valueList.push({ value: '', rowFlex: rowFlex as any })
        }

        return {
          id: getUUID(),
          colspan,
          rowspan,
          mergeSame,
          align: rawAlign,
          verticalAlign,
          height: customCellHeight,
          backgroundColor: bgColor,
          value: valueList
        }
      })

      if (rowCols > maxCols) maxCols = rowCols

      const isHeaderRow = isHeader && !loopConfig
      const hasColspan = tdList.some(td => (td.colspan || 1) > 1)
      const trAttrHeight =
        tr.getAttribute('height') ||
        (tr.getAttribute('style') || '').match(
          /(?:^|;)\s*height\s*:\s*(\d+)px/i
        )?.[1]
      const customTrHeight = trAttrHeight
        ? parseInt(trAttrHeight, 10)
        : maxCellHeight || undefined

      const trWhen = tr.getAttribute('when') || undefined

      return {
        id: getUUID(),
        height: customTrHeight || (isHeaderRow ? 35 : hasColspan ? 32 : 36),
        isHeader: isHeaderRow,
        pagingRepeat: isHeaderRow ? options?.pagingRepeat !== false : undefined,
        when: trWhen,
        loopConfig,
        tdList
      }
    })

    const availableWidth = options?.availableWidth || 554
    const colWidth = Math.floor(availableWidth / Math.max(maxCols, 1))

    const tableId = getUUID()
    const sanitizedTrList = sanitizeTrList(trList)
    sanitizedTrList.forEach(tr => {
      const trId = tr.id || getUUID()
      tr.id = trId
      tr.tdList.forEach((td: any) => {
        const tdId = td.id || getUUID()
        td.id = tdId
        if (Array.isArray(td.value)) {
          td.value.forEach((valEl: any) => {
            valEl.tdId = tdId
            valEl.trId = trId
            valEl.tableId = tableId
          })
        }
      })
    })

    return {
      id: tableId,
      type: 'table',
      value: '',
      conceptId: conceptId || 'table',
      name: options?.name || tableEl.getAttribute('name') || '',
      pagingRepeat: options?.pagingRepeat !== false,
      colgroup: Array.from({ length: maxCols }, () => ({ width: colWidth })),
      trList: sanitizedTrList
    }
  } catch (e) {
    console.warn('[parseTableHtml] 解析 HTML 表格异常:', e)
    return null
  }
}

export * from './request'
export * from '../components/toast'
export * from './debugTable'
