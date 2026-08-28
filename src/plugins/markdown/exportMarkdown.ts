import {
  IElement,
  ElementType,
  ListType,
  Command
} from '../../editor'

declare module '../../editor' {
  interface Command {
    executeExportMarkdown(): string
  }
}

const ZERO = '\u200B'

// 将内联元素转为 Markdown 文本
function convertInlineToMarkdown(element: IElement): string {
  if (element.type === ElementType.IMAGE) {
    return `![${element.value}](${element.value})`
  }
  if (element.type === ElementType.HYPERLINK) {
    const text = element.valueList
      ? element.valueList.map(convertInlineToMarkdown).join('')
      : ''
    return `[${text}](${element.url || ''})`
  }
  if (element.type === ElementType.LATEX) {
    return `$$${element.value}$$`
  }
  if (element.type === ElementType.CHECKBOX) {
    return element.checkbox?.value ? '[x] ' : '[ ] '
  }
  if (element.type === ElementType.RADIO) {
    return element.radio?.value ? '(o) ' : '( ) '
  }
  if (element.type === ElementType.SUPERSCRIPT) {
    return `<sup>${element.value}</sup>`
  }
  if (element.type === ElementType.SUBSCRIPT) {
    return `<sub>${element.value}</sub>`
  }

  // 普通文本
  let text = element.value || ''
  if (element.bold) text = `**${text}**`
  if (element.italic) text = `*${text}*`
  if (element.strikeout) text = `~~${text}~~`
  if (element.underline) text = `<u>${text}</u>`
  if (element.highlight) text = `==${text}==`

  return text
}

// 拆分列表项（参考 canvas-editor splitListElement）
function splitListElement(elementList: IElement[]): Map<number, IElement[]> {
  let curListIndex = 0
  const listElementListMap: Map<number, IElement[]> = new Map()
  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]
    if (element.listWrap) {
      const listElementList = listElementListMap.get(curListIndex) || []
      listElementList.push(element)
      listElementListMap.set(curListIndex, listElementList)
    } else {
      const valueList = element.value.split('\n')
      for (let c = 0; c < valueList.length; c++) {
        if (c > 0) {
          curListIndex += 1
        }
        const value = valueList[c]
        const listElementList = listElementListMap.get(curListIndex) || []
        listElementList.push({
          ...element,
          value
        })
        listElementListMap.set(curListIndex, listElementList)
      }
    }
  }
  return listElementListMap
}

// 将 IElement[] 转为 Markdown（参考 canvas-editor getTextFromElementList）
function buildMarkdown(elementList: IElement[]): string {
  let markdown = ''

  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]

    if (element.type === ElementType.TABLE) {
      markdown += '\n'
      const trList = element.trList!
      for (let t = 0; t < trList.length; t++) {
        const tr = trList[t]
        const cells: string[] = []
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          const tdText = buildMarkdown(td.value || [])
          cells.push(tdText.trim())
        }
        markdown += `| ${cells.join(' | ')} |\n`
        if (t === 0) {
          markdown += `| ${cells.map(() => '---').join(' | ')} |\n`
        }
      }
      markdown += '\n'
    } else if (element.type === ElementType.TITLE) {
      const level =
        element.level === 'first'
          ? 1
          : element.level === 'second'
            ? 2
            : element.level === 'third'
              ? 3
              : element.level === 'fourth'
                ? 4
                : element.level === 'fifth'
                  ? 5
                  : 6
      // valueList 中可能包含 TABLE、LIST 等块级元素，需要递归处理
      const content = buildMarkdown(element.valueList || [])
      markdown += `${'#'.repeat(level)} ${content}\n\n`
    } else if (element.type === ElementType.LIST) {
      const valueList = [...(element.valueList || [])]
      if (valueList[0]?.value === '\n') {
        valueList.shift()
      }
      const listElementListMap = splitListElement(valueList)
      listElementListMap.forEach((listElementList, listIndex) => {
        const isLast = listElementListMap.size - 1 === listIndex
        const isOrdered = element.listType === ListType.OL
        const prefix = isOrdered ? `${listIndex + 1}. ` : '- '
        // 列表项内可能有块级元素，用 buildMarkdown 处理
        const itemText = buildMarkdown(listElementList).replace(/^\n/, '')
        markdown += `${prefix}${itemText}${isLast ? '\n' : '\n'}`
      })
      markdown += '\n'
    } else if (element.type === ElementType.SEPARATOR) {
      markdown += '---\n\n'
    } else if (element.type === ElementType.PAGE_BREAK) {
      markdown += '<!-- page break -->\n\n'
    } else if (element.type === ElementType.IMAGE) {
      markdown += `${convertInlineToMarkdown(element)}\n\n`
    } else {
      // 普通文本/无类型元素
      let text = element.value || ''
      if (element.type === ElementType.CONTROL) {
        const controlValue = element.control?.value?.[0]?.value || ''
        text = controlValue
          ? `${element.control?.preText || ''}${controlValue}${
              element.control?.postText || ''
            }`
          : ''
      } else if (element.type === ElementType.DATE) {
        text = element.valueList?.map(v => v.value).join('') || ''
      }
      // ZERO → 换行
      text = text.replace(new RegExp(`${ZERO}`, 'g'), '\n')
      markdown += text
    }
  }

  return markdown
}

export default function (command: Command) {
  return function (): string {
    const {
      data: { header, main, footer }
    } = command.getValue()

    let markdown = buildMarkdown(main || [])
    if (header?.length) {
      markdown = buildMarkdown(header) + '\n---\n' + markdown
    }
    if (footer?.length) {
      markdown = markdown + '\n---\n' + buildMarkdown(footer)
    }

    return markdown.trim() + '\n'
  }
}
