import {
  Command,
  IElement,
  ElementType,
  TitleLevel,
  ListType,
  ListStyle
} from '../../editor'
import { marked, type Token } from 'marked'
import { IImportMarkdownOption } from './interface'

declare module '../../editor' {
  interface Command {
    executeImportMarkdown(options: IImportMarkdownOption): void
  }
}

// 标题深度映射到 TitleLevel
const depthTitleLevelMap: Record<number, TitleLevel> = {
  1: TitleLevel.FIRST,
  2: TitleLevel.SECOND,
  3: TitleLevel.THIRD,
  4: TitleLevel.FOURTH,
  5: TitleLevel.FIFTH,
  6: TitleLevel.SIXTH
}

// 将内联 tokens 转为 IElement[]
function convertInlineTokens(tokens: Token[]): IElement[] {
  const elements: IElement[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
        elements.push(
          ...convertInlineTokens(token.tokens || []).map(el => ({
            ...el,
            bold: true
          }))
        )
        break
      case 'em':
        elements.push(
          ...convertInlineTokens(token.tokens || []).map(el => ({
            ...el,
            italic: true
          }))
        )
        break
      case 'del':
        elements.push(
          ...convertInlineTokens(token.tokens || []).map(el => ({
            ...el,
            strikeout: true
          }))
        )
        break
      case 'codespan':
        elements.push({ type: ElementType.TEXT, value: token.text })
        break
      case 'link':
        elements.push({
          type: ElementType.HYPERLINK,
          value: '',
          url: token.href,
          valueList: convertInlineTokens(token.tokens || [])
        })
        break
      case 'image':
        elements.push({
          type: ElementType.IMAGE,
          value: token.href
        })
        break
      case 'br':
        elements.push({ type: ElementType.TEXT, value: '\n' })
        break
      case 'text':
      case 'escape':
        elements.push({ type: ElementType.TEXT, value: token.text })
        break
      default:
        if ('text' in token) {
          elements.push({ type: ElementType.TEXT, value: (token as any).text })
        }
    }
  }
  return elements
}

// 将列表项 tokens 转为 IElement[]
function convertListItemTokens(tokens: Token[]): IElement[] {
  const elements: IElement[] = []
  for (const token of tokens) {
    if (token.type === 'paragraph') {
      elements.push(...convertInlineTokens(token.tokens || []))
    } else if (token.type === 'text') {
      elements.push({ type: ElementType.TEXT, value: token.text })
    } else if (token.type === 'list') {
      for (const item of token.items) {
        const itemTokens: Token[] = item.tokens as Token[]
        elements.push(...convertListItemTokens(itemTokens))
      }
    }
  }
  return elements
}

// 将块级 tokens 转为 IElement[]
function convertBlockTokens(tokens: Token[]): IElement[] {
  const elements: IElement[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const inlineElements = convertInlineTokens(token.tokens || [])
        elements.push({
          type: ElementType.TITLE,
          value: '',
          level: depthTitleLevelMap[token.depth] || TitleLevel.FIRST,
          valueList: inlineElements
        })
        break
      }
      case 'paragraph': {
        const inlineElements = convertInlineTokens(token.tokens || [])
        elements.push({ type: ElementType.TEXT, value: '\n' })
        elements.push(...inlineElements)
        elements.push({ type: ElementType.TEXT, value: '\n' })
        break
      }
      case 'list': {
        const listType = token.ordered ? ListType.OL : ListType.UL
        const listStyle = token.ordered ? ListStyle.DECIMAL : ListStyle.DISC

        // valueList 中每个列表项之间用 \n 分隔
        // formatElementList 会自动展开 LIST 为带 listId/listType/listStyle 的 TEXT 元素
        const valueList: IElement[] = []
        for (let li = 0; li < token.items.length; li++) {
          const item = token.items[li]
          const itemTokens: Token[] = item.tokens as Token[]
          const itemElements = convertListItemTokens(itemTokens)
          if (itemElements.length === 0) {
            itemElements.push({ type: ElementType.TEXT, value: '' })
          }
          valueList.push(...itemElements)
          if (li < token.items.length - 1) {
            valueList.push({ type: ElementType.TEXT, value: '\n' })
          }
        }

        elements.push({
          type: ElementType.LIST,
          value: '',
          listType,
          listStyle,
          valueList
        })
        break
      }
      case 'code': {
        const lines = token.text.split('\n')
        for (let i = 0; i < lines.length; i++) {
          elements.push({ type: ElementType.TEXT, value: lines[i] })
          if (i < lines.length - 1) {
            elements.push({ type: ElementType.TEXT, value: '\n' })
          }
        }
        elements.push({ type: ElementType.TEXT, value: '\n' })
        break
      }
      case 'blockquote': {
        const inlineElements = convertInlineTokens(token.tokens || [])
        elements.push({ type: ElementType.TEXT, value: '\n' })
        elements.push(
          ...inlineElements.map(el => ({
            ...el,
            italic: true
          }))
        )
        elements.push({ type: ElementType.TEXT, value: '\n' })
        break
      }
      case 'hr': {
        elements.push({
          type: ElementType.SEPARATOR,
          value: ''
        })
        break
      }
      case 'table': {
        const trList: any[] = []
        // 表头行
        const headerTdList = (token.header || []).map(
          (cell: { tokens?: Token[] }) => ({
            colspan: 1,
            rowspan: 1,
            // td.value 需要是 IElement[]，formatElementList 会递归处理
            value: convertInlineTokens(cell.tokens || [])
          })
        )
        trList.push({
          height: 30,
          tdList: headerTdList
        })
        // 表体行
        for (const row of token.rows || []) {
          const tdList = (row as Array<{ tokens?: Token[] }>).map(cell => ({
            colspan: 1,
            rowspan: 1,
            value: convertInlineTokens(cell.tokens || [])
          }))
          trList.push({
            height: 30,
            tdList
          })
        }
        elements.push({
          type: ElementType.TABLE,
          value: '\n',
          trList
        })
        break
      }
      case 'space':
      case 'text': {
        if ('text' in token && token.text) {
          elements.push({ type: ElementType.TEXT, value: token.text })
        }
        break
      }
    }
  }

  return elements
}

export default function (command: Command) {
  return function (options: IImportMarkdownOption): void {
    const tokens = marked.lexer(options.value)
    const main = convertBlockTokens(tokens)
    command.executeSetValue({ main })
  }
}
