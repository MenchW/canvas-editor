import { commentList, data, options } from './mock'
import './style.css'
import prism from 'prismjs'
import docxPlugin from './plugins/docx'
import { EditorBridge } from './bridge'
import Editor, {
  BlockType,
  Command,
  ControlState,
  ControlType,
  EditorMode,
  EditorZone,
  ElementType,
  IBlock,
  ICatalogItem,
  IElement,
  KeyMap,
  ListStyle,
  ListType,
  PageMode,
  PaperDirection,
  RowFlex,
  TextDecorationStyle,
  TitleLevel,
  splitText
} from './editor'
import { Dialog } from './components/dialog/Dialog'
import { formatPrismToken } from './utils/prism'
import { Signature } from './components/signature/Signature'
import {
  debounce,
  nextTick,
  bindDragData,
  scrollIntoView,
  http,
  toast,
  sanitizePlaceholderText,
  sanitizeTrList,
  parseTableHtml
} from './utils'

// 配置统一的 RuoYi 鉴权请求拦截器
const DEFAULT_AUTH_TOKEN =
  'eyJhbGciOiJIUzUxMiJ9.eyJ1c2VyX2lkIjoxLCJ1c2VyX2tleSI6IjY2OGFmODE3LTQ3OGUtNGZiMy04NTUyLWRiNWNlZjE3NDk5MiIsInVzZXJuYW1lIjoiaG50Y19jZW50ZXIifQ.2e4vihsGf4NapJr61s3yxPXs-AdMtcOO00fdv0JO6p_1q6XMD4XRh1YyBbBo0V0qrhZLBu5IGOLP5VQUDpWpZw'

function getAuthToken() {
  const match = document.cookie.match(/(^|;\s*)Admin-Token=([^;]*)/)
  if (match && match[2]) {
    return decodeURIComponent(match[2])
  }
  const storageToken =
    localStorage.getItem('Admin-Token') || localStorage.getItem('token')
  if (storageToken) {
    return storageToken
  }
  return DEFAULT_AUTH_TOKEN
}

http.addRequestInterceptor((url, options) => {
  const token = getAuthToken()
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  }
  return { url, options }
})

window.onload = function () {
  // -------------------------------------------------------------
  // 0. 顶层安全的细粒度功能控制 (IFeatureConfig) 状态机与归一化解析器
  // -------------------------------------------------------------
  const DEFAULT_FEATURE_CONFIG = {
    save: true,
    print: true,
    export: true,
    control: true,
    asidePanel: true,
    modeSwitch: true,
    comment: true,
    signature: true,
    macro: true
  }

  let activeFeatureConfig = { ...DEFAULT_FEATURE_CONFIG }

  const resolveFeatureConfig = (features?: any) => {
    if (features === true) {
      return {
        save: true,
        print: true,
        export: true,
        control: true,
        asidePanel: true,
        modeSwitch: true,
        comment: true,
        signature: true,
        macro: true
      }
    }
    if (typeof features === 'object' && features !== null) {
      const isAll = Boolean(features.all)
      return {
        save: features.save ?? isAll,
        print: features.print ?? true,
        export: features.export ?? isAll,
        control: features.control ?? isAll,
        asidePanel: features.asidePanel ?? isAll,
        modeSwitch: features.modeSwitch ?? isAll,
        comment: features.comment ?? isAll,
        signature: features.signature ?? isAll,
        macro: features.macro ?? isAll
      }
    }
    return { ...DEFAULT_FEATURE_CONFIG }
  }

  const isApple =
    typeof navigator !== 'undefined' && /Mac OS X/.test(navigator.userAgent)

  const retryBtn =
    document.querySelector<HTMLButtonElement>('#loading-retry-btn')

  const isEmbeddedInIframe = window.parent && window.parent !== window
  const urlParams = new URLSearchParams(window.location.search)
  let currentAppId = urlParams.get('appId') || 'chvLlhGt7pKwvUom'
  const LOCAL_STORAGE_KEY = 'canvas-editor-cache'
  const localCache = localStorage.getItem(LOCAL_STORAGE_KEY)
  let initialData: any = []
  let initialOptions: any = {}

  if (localCache && !isEmbeddedInIframe) {
    try {
      const parsed = JSON.parse(localCache)
      if (parsed && parsed.options) {
        initialOptions = { ...options, ...parsed.options }
      }
      if (parsed && parsed.data && Array.isArray(parsed.data.main)) {
        initialData = parsed.data
      } else if (
        parsed &&
        (Array.isArray(parsed) || Array.isArray(parsed.main))
      ) {
        initialData = parsed
      }
    } catch (e) {
      console.error('读取本地缓存数据失败:', e)
    }
  }

  const container = document.querySelector<HTMLDivElement>('.editor')!
  const instance = new Editor(container, initialData, initialOptions)
  instance.use(docxPlugin)
  console.log('实例: ', instance)

  Reflect.set(window, 'editor', instance)
  Reflect.set(window, 'mockData', data)
  Reflect.set(window, '__CANVAS_EDITOR_INSTANCE__', instance)

  // -------------------------------------------------------------
  // 核心 1：顶层前置实例化 EditorBridge RPC 通信网关
  // -------------------------------------------------------------
  const bridge = new EditorBridge({
    instance,
    updateComponents,
    setCustomConfig
  })

  // -------------------------------------------------------------
  // 核心 2：拦截画布全局粘贴 Ctrl+V 中的图片，统一发给宿主 onUploadImage 异步换 OSS 地址
  // -------------------------------------------------------------
  instance.override.pasteImage = (file: File | Blob) => {
    const fileReader = new FileReader()
    fileReader.readAsDataURL(file)
    fileReader.onload = () => {
      const image = new Image()
      const base64Value = fileReader.result as string
      image.src = base64Value
      image.onload = async () => {
        const imageUrl = await bridge.notifyUploadImage(base64Value)
        instance.command.executeImage({
          value: imageUrl,
          width: image.width,
          height: image.height
        })
      }
    }
  }

  // 菜单弹窗销毁
  window.addEventListener(
    'click',
    evt => {
      const visibleDom = document.querySelector('.visible')
      if (!visibleDom || visibleDom.contains(<Node>evt.target)) return
      visibleDom.classList.remove('visible')
    },
    {
      capture: true
    }
  )

  // 2. | 撤销 | 重做 | 格式刷 | 清除格式 |
  const undoDom = document.querySelector<HTMLDivElement>('.menu-item__undo')!
  undoDom.title = `撤销(${isApple ? '⌘' : 'Ctrl'}+Z)`
  undoDom.onclick = function () {
    if (undoDom.classList.contains('no-allow')) return
    console.log('undo')
    instance.command.executeUndo()
  }

  const redoDom = document.querySelector<HTMLDivElement>('.menu-item__redo')!
  redoDom.title = `重做(${isApple ? '⌘' : 'Ctrl'}+Y)`
  redoDom.onclick = function () {
    if (redoDom.classList.contains('no-allow')) return
    console.log('redo')
    instance.command.executeRedo()
  }

  const painterDom = document.querySelector<HTMLDivElement>(
    '.menu-item__painter'
  )!

  let isFirstClick = true
  let painterTimeout: number
  painterDom.onclick = function () {
    if (isFirstClick) {
      isFirstClick = false
      painterTimeout = window.setTimeout(() => {
        console.log('painter-click')
        isFirstClick = true
        instance.command.executePainter({
          isDblclick: false
        })
      }, 200)
    } else {
      window.clearTimeout(painterTimeout)
    }
  }

  painterDom.ondblclick = function () {
    console.log('painter-dblclick')
    isFirstClick = true
    window.clearTimeout(painterTimeout)
    instance.command.executePainter({
      isDblclick: true
    })
  }

  document.querySelector<HTMLDivElement>('.menu-item__format')!.onclick =
    function () {
      console.log('format')
      instance.command.executeFormat()
    }

  // 3. | 字体 | 字体变大 | 字体变小 | 加粗 | 斜体 | 下划线 | 删除线 | 上标 | 下标 | 字体颜色 | 背景色 |
  const fontDom = document.querySelector<HTMLDivElement>('.menu-item__font')!
  const fontSelectDom = fontDom.querySelector<HTMLDivElement>('.select')!
  const fontOptionDom = fontDom.querySelector<HTMLDivElement>('.options')!
  fontDom.onclick = function () {
    console.log('font')
    fontOptionDom.classList.toggle('visible')
  }
  fontOptionDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    instance.command.executeFont(li.dataset.family!)
  }

  const sizeSetDom = document.querySelector<HTMLDivElement>('.menu-item__size')!
  const sizeSelectDom = sizeSetDom.querySelector<HTMLDivElement>('.select')!
  const sizeOptionDom = sizeSetDom.querySelector<HTMLDivElement>('.options')!
  sizeSetDom.title = `设置字号`
  sizeSetDom.onclick = function () {
    console.log('size')
    sizeOptionDom.classList.toggle('visible')
  }
  sizeOptionDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    instance.command.executeSize(Number(li.dataset.size!))
  }

  const sizeAddDom = document.querySelector<HTMLDivElement>(
    '.menu-item__size-add'
  )!
  sizeAddDom.title = `增大字号(${isApple ? '⌘' : 'Ctrl'}+[)`
  sizeAddDom.onclick = function () {
    console.log('size-add')
    instance.command.executeSizeAdd()
  }

  const sizeMinusDom = document.querySelector<HTMLDivElement>(
    '.menu-item__size-minus'
  )!
  sizeMinusDom.title = `减小字号(${isApple ? '⌘' : 'Ctrl'}+])`
  sizeMinusDom.onclick = function () {
    console.log('size-minus')
    instance.command.executeSizeMinus()
  }

  const boldDom = document.querySelector<HTMLDivElement>('.menu-item__bold')!
  boldDom.title = `加粗(${isApple ? '⌘' : 'Ctrl'}+B)`
  boldDom.onclick = function () {
    console.log('bold')
    instance.command.executeBold()
  }

  const italicDom =
    document.querySelector<HTMLDivElement>('.menu-item__italic')!
  italicDom.title = `斜体(${isApple ? '⌘' : 'Ctrl'}+I)`
  italicDom.onclick = function () {
    console.log('italic')
    instance.command.executeItalic()
  }

  const underlineDom = document.querySelector<HTMLDivElement>(
    '.menu-item__underline'
  )!
  underlineDom.title = `下划线(${isApple ? '⌘' : 'Ctrl'}+U)`
  const underlineOptionDom =
    underlineDom.querySelector<HTMLDivElement>('.options')!
  underlineDom.querySelector<HTMLSpanElement>('.select')!.onclick =
    function () {
      underlineOptionDom.classList.toggle('visible')
    }
  underlineDom.querySelector<HTMLElement>('i')!.onclick = function () {
    console.log('underline')
    instance.command.executeUnderline()
    underlineOptionDom.classList.remove('visible')
  }
  underlineDom.querySelector<HTMLUListElement>('ul')!.onmousedown = function (
    evt
  ) {
    const li = evt.target as HTMLLIElement
    const decorationStyle = <TextDecorationStyle>li.dataset.decorationStyle
    instance.command.executeUnderline({
      style: decorationStyle
    })
    underlineOptionDom.classList.remove('visible')
  }

  const strikeoutDom = document.querySelector<HTMLDivElement>(
    '.menu-item__strikeout'
  )!
  strikeoutDom.onclick = function () {
    console.log('strikeout')
    instance.command.executeStrikeout()
  }

  const superscriptDom = document.querySelector<HTMLDivElement>(
    '.menu-item__superscript'
  )!
  superscriptDom.title = `上标(${isApple ? '⌘' : 'Ctrl'}+Shift+,)`
  superscriptDom.onclick = function () {
    console.log('superscript')
    instance.command.executeSuperscript()
  }

  const subscriptDom = document.querySelector<HTMLDivElement>(
    '.menu-item__subscript'
  )!
  subscriptDom.title = `下标(${isApple ? '⌘' : 'Ctrl'}+Shift+.)`
  subscriptDom.onclick = function () {
    console.log('subscript')
    instance.command.executeSubscript()
  }

  const colorControlDom = document.querySelector<HTMLInputElement>('#color')!
  colorControlDom.oninput = function () {
    instance.command.executeColor(colorControlDom.value)
  }
  const colorDom = document.querySelector<HTMLDivElement>('.menu-item__color')!
  const colorSpanDom = colorDom.querySelector('span')!
  colorDom.onclick = function () {
    console.log('color')
    colorControlDom.click()
  }

  const highlightControlDom =
    document.querySelector<HTMLInputElement>('#highlight')!
  highlightControlDom.oninput = function () {
    instance.command.executeHighlight(highlightControlDom.value)
  }
  const highlightDom = document.querySelector<HTMLDivElement>(
    '.menu-item__highlight'
  )!
  const highlightSpanDom = highlightDom.querySelector('span')!
  highlightDom.onclick = function () {
    console.log('highlight')
    highlightControlDom?.click()
  }

  const titleGalleryDom = document.querySelector<HTMLDivElement>(
    '.menu-item__title-gallery'
  )!
  const titleContainerDom = titleGalleryDom.querySelector<HTMLDivElement>(
    '.title-gallery__container'
  )!

  titleContainerDom.onwheel = function (evt: WheelEvent) {
    evt.preventDefault()
    titleContainerDom.scrollLeft += evt.deltaY
  }

  titleContainerDom.onclick = function (evt) {
    const target = (evt.target as HTMLElement).closest(
      '.title-gallery__item'
    ) as HTMLDivElement | null
    if (!target) return
    const level = <TitleLevel>(target.dataset.level || '')
    instance.command.executeTitle(level || null)
  }

  const leftDom = document.querySelector<HTMLDivElement>('.menu-item__left')!
  leftDom.title = `左对齐(${isApple ? '⌘' : 'Ctrl'}+L)`
  leftDom.onclick = function () {
    console.log('left')
    instance.command.executeRowFlex(RowFlex.LEFT)
  }

  const centerDom =
    document.querySelector<HTMLDivElement>('.menu-item__center')!
  centerDom.title = `居中对齐(${isApple ? '⌘' : 'Ctrl'}+E)`
  centerDom.onclick = function () {
    console.log('center')
    instance.command.executeRowFlex(RowFlex.CENTER)
  }

  const rightDom = document.querySelector<HTMLDivElement>('.menu-item__right')!
  rightDom.title = `右对齐(${isApple ? '⌘' : 'Ctrl'}+R)`
  rightDom.onclick = function () {
    console.log('right')
    instance.command.executeRowFlex(RowFlex.RIGHT)
  }

  const alignmentDom = document.querySelector<HTMLDivElement>(
    '.menu-item__alignment'
  )!
  alignmentDom.title = `两端对齐(${isApple ? '⌘' : 'Ctrl'}+J)`
  alignmentDom.onclick = function () {
    console.log('alignment')
    instance.command.executeRowFlex(RowFlex.ALIGNMENT)
  }

  const justifyDom = document.querySelector<HTMLDivElement>(
    '.menu-item__justify'
  )!
  justifyDom.title = `分散对齐(${isApple ? '⌘' : 'Ctrl'}+Shift+J)`
  justifyDom.onclick = function () {
    console.log('justify')
    instance.command.executeRowFlex(RowFlex.JUSTIFY)
  }

  const rowMarginDom = document.querySelector<HTMLDivElement>(
    '.menu-item__row-margin'
  )!
  const rowOptionDom = rowMarginDom.querySelector<HTMLDivElement>('.options')!
  rowMarginDom.onclick = function () {
    console.log('row-margin')
    rowOptionDom.classList.toggle('visible')
  }
  rowOptionDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    instance.command.executeRowMargin(Number(li.dataset.rowmargin!))
  }

  const listDom = document.querySelector<HTMLDivElement>('.menu-item__list')!
  listDom.title = `列表(${isApple ? '⌘' : 'Ctrl'}+Shift+U)`
  const listOptionDom = listDom.querySelector<HTMLDivElement>('.options')!
  listDom.onclick = function () {
    console.log('list')
    listOptionDom.classList.toggle('visible')
  }
  listOptionDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    const listType = <ListType>li.dataset.listType || null
    const listStyle = <ListStyle>(<unknown>li.dataset.listStyle)
    instance.command.executeList(listType, listStyle)
  }

  // 4. | 表格 | 图片 | 超链接 | 分割线 | 水印 | 代码块 | 分隔符 | 控件 | 复选框 | LaTeX | 日期选择器
  const tableDom = document.querySelector<HTMLDivElement>('.menu-item__table')!
  const tablePanelContainer = document.querySelector<HTMLDivElement>(
    '.menu-item__table__collapse'
  )!
  const tableClose = document.querySelector<HTMLDivElement>('.table-close')!
  const tableTitle = document.querySelector<HTMLDivElement>('.table-select')!
  const tablePanel = document.querySelector<HTMLDivElement>('.table-panel')!
  // 绘制行列
  const tableCellList: HTMLDivElement[][] = []
  for (let i = 0; i < 10; i++) {
    const tr = document.createElement('tr')
    tr.classList.add('table-row')
    const trCellList: HTMLDivElement[] = []
    for (let j = 0; j < 10; j++) {
      const td = document.createElement('td')
      td.classList.add('table-cel')
      tr.append(td)
      trCellList.push(td)
    }
    tablePanel.append(tr)
    tableCellList.push(trCellList)
  }
  let colIndex = 0
  let rowIndex = 0
  // 移除所有格选择
  function removeAllTableCellSelect() {
    tableCellList.forEach(tr => {
      tr.forEach(td => td.classList.remove('active'))
    })
  }
  // 设置标题内容
  function setTableTitle(payload: string) {
    tableTitle.innerText = payload
  }
  // 恢复初始状态
  function recoveryTable() {
    // 还原选择样式、标题、选择行列
    removeAllTableCellSelect()
    setTableTitle('插入')
    colIndex = 0
    rowIndex = 0
    // 隐藏panel
    tablePanelContainer.style.display = 'none'
  }
  tableDom.onclick = function () {
    console.log('table')
    tablePanelContainer!.style.display = 'block'
  }
  tablePanel.onmousemove = function (evt) {
    const celSize = 16
    const rowMarginTop = 10
    const celMarginRight = 6
    const { offsetX, offsetY } = evt
    // 移除所有选择
    removeAllTableCellSelect()
    colIndex = Math.ceil(offsetX / (celSize + celMarginRight)) || 1
    rowIndex = Math.ceil(offsetY / (celSize + rowMarginTop)) || 1
    // 改变选择样式
    tableCellList.forEach((tr, trIndex) => {
      tr.forEach((td, tdIndex) => {
        if (tdIndex < colIndex && trIndex < rowIndex) {
          td.classList.add('active')
        }
      })
    })
    // 改变表格标题
    setTableTitle(`${rowIndex}×${colIndex}`)
  }
  tableClose.onclick = function () {
    recoveryTable()
  }
  tablePanel.onclick = function () {
    // 应用选择
    instance.command.executeInsertTable(rowIndex, colIndex)
    recoveryTable()
  }

  const imageDom = document.querySelector<HTMLDivElement>('.menu-item__image')!
  const imageFileDom = document.querySelector<HTMLInputElement>('#image')!
  imageDom.onclick = function () {
    imageFileDom.click()
  }
  imageFileDom.onchange = function () {
    const file = imageFileDom.files![0]!
    const fileReader = new FileReader()
    fileReader.readAsDataURL(file)
    fileReader.onload = function () {
      const image = new Image()
      const base64Value = fileReader.result as string
      image.src = base64Value
      image.onload = async function () {
        // 🌟 核心：通过宿主 uploadImage Hook 异步将本地图片 base64 上传为在线 https OSS 地址
        const imageUrl = await bridge.notifyUploadImage(base64Value)
        instance.command.executeImage({
          value: imageUrl,
          width: image.width,
          height: image.height
        })
        imageFileDom.value = ''
      }
    }
  }

  const hyperlinkDom = document.querySelector<HTMLDivElement>(
    '.menu-item__hyperlink'
  )!
  hyperlinkDom.onclick = function () {
    console.log('hyperlink')
    new Dialog({
      title: '超链接',
      data: [
        {
          type: 'text',
          label: '文本',
          name: 'name',
          required: true,
          placeholder: '请输入文本',
          value: instance.command.getRangeText()
        },
        {
          type: 'text',
          label: '链接',
          name: 'url',
          required: true,
          placeholder: '请输入链接'
        }
      ],
      onConfirm: payload => {
        const name = payload.find(p => p.name === 'name')?.value
        if (!name) return
        const url = payload.find(p => p.name === 'url')?.value
        if (!url) return
        instance.command.executeHyperlink({
          url,
          valueList: splitText(name).map(n => ({
            value: n,
            size: 16
          }))
        })
      }
    })
  }

  const separatorDom = document.querySelector<HTMLDivElement>(
    '.menu-item__separator'
  )!
  const separatorOptionDom =
    separatorDom.querySelector<HTMLDivElement>('.options')!
  separatorDom.onclick = function () {
    console.log('separator')
    separatorOptionDom.classList.toggle('visible')
  }
  separatorOptionDom.onmousedown = function (evt) {
    let payload: number[] = []
    const li = evt.target as HTMLLIElement
    const separatorDash = li.dataset.separator?.split(',').map(Number)
    if (separatorDash) {
      const isSingleLine = separatorDash.every(d => d === 0)
      if (!isSingleLine) {
        payload = separatorDash
      }
    }
    instance.command.executeSeparator(payload)
  }

  const pageBreakDom = document.querySelector<HTMLDivElement>(
    '.menu-item__page-break'
  )!
  pageBreakDom.onclick = function () {
    console.log('pageBreak')
    instance.command.executePageBreak()
  }

  const watermarkDom = document.querySelector<HTMLDivElement>(
    '.menu-item__watermark'
  )!
  const watermarkOptionDom =
    watermarkDom.querySelector<HTMLDivElement>('.options')!
  watermarkDom.onclick = function () {
    console.log('watermark')
    watermarkOptionDom.classList.toggle('visible')
  }
  watermarkOptionDom.onmousedown = function (evt) {
    const li = evt.target as HTMLLIElement
    const menu = li.dataset.menu!
    watermarkOptionDom.classList.toggle('visible')
    if (menu === 'add') {
      new Dialog({
        title: '水印',
        data: [
          {
            type: 'text',
            label: '内容',
            name: 'data',
            required: true,
            placeholder: '请输入内容'
          },
          {
            type: 'color',
            label: '颜色',
            name: 'color',
            required: true,
            value: '#AEB5C0'
          },
          {
            type: 'number',
            label: '字体大小',
            name: 'size',
            required: true,
            value: '120'
          },
          {
            type: 'number',
            label: '透明度',
            name: 'opacity',
            required: true,
            value: '0.3'
          },
          {
            type: 'select',
            label: '重复',
            name: 'repeat',
            value: '0',
            required: false,
            options: [
              {
                label: '不重复',
                value: '0'
              },
              {
                label: '重复',
                value: '1'
              }
            ]
          },
          {
            type: 'number',
            label: '水平间隔',
            name: 'horizontalGap',
            required: false,
            value: '10'
          },
          {
            type: 'number',
            label: '垂直间隔',
            name: 'verticalGap',
            required: false,
            value: '10'
          }
        ],
        onConfirm: payload => {
          const nullableIndex = payload.findIndex(p => !p.value)
          if (~nullableIndex) return
          const watermark = payload.reduce(
            (pre, cur) => {
              pre[cur.name] = cur.value
              return pre
            },
            <any>{}
          )
          const repeat = watermark.repeat === '1'
          instance.command.executeAddWatermark({
            data: watermark.data,
            color: watermark.color,
            size: Number(watermark.size),
            opacity: Number(watermark.opacity),
            repeat,
            gap:
              repeat && watermark.horizontalGap && watermark.verticalGap
                ? [
                    Number(watermark.horizontalGap),
                    Number(watermark.verticalGap)
                  ]
                : undefined
          })
        }
      })
    } else {
      instance.command.executeDeleteWatermark()
    }
  }

  const codeblockDom = document.querySelector<HTMLDivElement>(
    '.menu-item__codeblock'
  )!
  codeblockDom.onclick = function () {
    console.log('codeblock')
    new Dialog({
      title: '代码块',
      data: [
        {
          type: 'textarea',
          name: 'codeblock',
          placeholder: '请输入代码',
          width: 500,
          height: 300
        }
      ],
      onConfirm: payload => {
        const codeblock = payload.find(p => p.name === 'codeblock')?.value
        if (!codeblock) return
        const tokenList = prism.tokenize(codeblock, prism.languages.javascript)
        const formatTokenList = formatPrismToken(tokenList)
        const elementList: IElement[] = []
        for (let i = 0; i < formatTokenList.length; i++) {
          const formatToken = formatTokenList[i]
          const tokenStringList = splitText(formatToken.content)
          for (let j = 0; j < tokenStringList.length; j++) {
            const value = tokenStringList[j]
            const element: IElement = {
              value
            }
            if (formatToken.color) {
              element.color = formatToken.color
            }
            if (formatToken.bold) {
              element.bold = true
            }
            if (formatToken.italic) {
              element.italic = true
            }
            elementList.push(element)
          }
        }
        elementList.unshift({
          value: '\n'
        })
        instance.command.executeInsertElementList(elementList)
      }
    })
  }

  const controlDom = document.querySelector<HTMLDivElement>(
    '.menu-item__control'
  )!
  const controlOptionDom = controlDom.querySelector<HTMLDivElement>('.options')!
  controlDom.onclick = function () {
    console.log('control')
    controlOptionDom.classList.toggle('visible')
  }
  controlOptionDom.onmousedown = function (evt) {
    controlOptionDom.classList.toggle('visible')
    const li = evt.target as HTMLLIElement
    const type = <ControlType>li.dataset.control
    switch (type) {
      case ControlType.TEXT:
        new Dialog({
          title: '文本控件',
          data: [
            {
              type: 'text',
              label: '占位符',
              name: 'placeholder',
              required: true,
              placeholder: '请输入占位符',
              tips: '控件无内容时的提示文字（如：内容）'
            },
            {
              type: 'text',
              label: '默认值',
              name: 'value',
              placeholder: '请输入默认值',
              tips: '控件创建时默认填入的内容'
            },
            {
              type: 'text',
              label: '前文本',
              name: 'preText',
              placeholder: '请输入前文本（可选，例：其他：）',
              tips: '控件前面的固定文本（例：其他：，文本为空不显示）'
            },
            {
              type: 'text',
              label: '后文本',
              name: 'postText',
              placeholder: '请输入后文本（可选，例：。）',
              tips: '控件后面的固定文本（例：。，文本为空不显示）'
            }
          ],
          onConfirm: payload => {
            const placeholder = payload.find(
              p => p.name === 'placeholder'
            )?.value
            if (!placeholder) return
            const value = payload.find(p => p.name === 'value')?.value || ''
            const preText = payload.find(p => p.name === 'preText')?.value || ''
            const postText =
              payload.find(p => p.name === 'postText')?.value || ''
            instance.command.executeInsertControl({
              type: ElementType.CONTROL,
              value: '',
              control: {
                type,
                value: value
                  ? [
                      {
                        value
                      }
                    ]
                  : null,
                placeholder,
                preText,
                postText
              }
            })
          }
        })
        break
      case ControlType.SELECT:
        new Dialog({
          title: '列举控件',
          data: [
            {
              type: 'text',
              label: '占位符',
              name: 'placeholder',
              required: true,
              placeholder: '请输入占位符'
            },
            {
              type: 'text',
              label: '默认值',
              name: 'code',
              placeholder: '请输入默认值'
            },
            {
              type: 'textarea',
              label: '值集',
              name: 'valueSets',
              required: true,
              height: 100,
              placeholder: `请输入值集JSON，例：\n[{\n"value":"有",\n"code":"98175"\n}]`
            }
          ],
          onConfirm: payload => {
            const placeholder = payload.find(
              p => p.name === 'placeholder'
            )?.value
            if (!placeholder) return
            const valueSets = payload.find(p => p.name === 'valueSets')?.value
            if (!valueSets) return
            const code = payload.find(p => p.name === 'code')?.value
            instance.command.executeInsertControl({
              type: ElementType.CONTROL,
              value: '',
              control: {
                type,
                code,
                value: null,
                placeholder,
                valueSets: JSON.parse(valueSets)
              }
            })
          }
        })
        break
      case ControlType.CHECKBOX:
        new Dialog({
          title: '复选框控件',
          data: [
            {
              type: 'text',
              label: '默认值',
              name: 'code',
              placeholder: '请输入默认值，多个值以英文逗号分割'
            },
            {
              type: 'textarea',
              label: '值集',
              name: 'valueSets',
              required: true,
              height: 100,
              placeholder: `请输入值集JSON，例：\n[{\n"value":"有",\n"code":"98175"\n}]`
            }
          ],
          onConfirm: payload => {
            const valueSets = payload.find(p => p.name === 'valueSets')?.value
            if (!valueSets) return
            const code = payload.find(p => p.name === 'code')?.value
            instance.command.executeInsertControl({
              type: ElementType.CONTROL,
              value: '',
              control: {
                type,
                code,
                value: null,
                valueSets: JSON.parse(valueSets)
              }
            })
          }
        })
        break
      case ControlType.RADIO:
        new Dialog({
          title: '单选框控件',
          data: [
            {
              type: 'text',
              label: '默认值',
              name: 'code',
              placeholder: '请输入默认值'
            },
            {
              type: 'textarea',
              label: '值集',
              name: 'valueSets',
              required: true,
              height: 100,
              placeholder: `请输入值集JSON，例：\n[{\n"value":"有",\n"code":"98175"\n}]`
            }
          ],
          onConfirm: payload => {
            const valueSets = payload.find(p => p.name === 'valueSets')?.value
            if (!valueSets) return
            const code = payload.find(p => p.name === 'code')?.value
            instance.command.executeInsertControl({
              type: ElementType.CONTROL,
              value: '',
              control: {
                type,
                code,
                value: null,
                valueSets: JSON.parse(valueSets)
              }
            })
          }
        })
        break
      case ControlType.DATE:
        new Dialog({
          title: '日期控件',
          data: [
            {
              type: 'text',
              label: '占位符',
              name: 'placeholder',
              required: true,
              placeholder: '请输入占位符'
            },
            {
              type: 'text',
              label: '默认值',
              name: 'value',
              placeholder: '请输入默认值'
            },
            {
              type: 'select',
              label: '日期格式',
              name: 'dateFormat',
              value: 'yyyy-MM-dd hh:mm:ss',
              required: true,
              options: [
                {
                  label: 'yyyy-MM-dd hh:mm:ss',
                  value: 'yyyy-MM-dd hh:mm:ss'
                },
                {
                  label: 'yyyy-MM-dd',
                  value: 'yyyy-MM-dd'
                }
              ]
            }
          ],
          onConfirm: payload => {
            const placeholder = payload.find(
              p => p.name === 'placeholder'
            )?.value
            if (!placeholder) return
            const value = payload.find(p => p.name === 'value')?.value || ''
            const dateFormat =
              payload.find(p => p.name === 'dateFormat')?.value || ''
            instance.command.executeInsertControl({
              type: ElementType.CONTROL,
              value: '',
              control: {
                type,
                dateFormat,
                value: value
                  ? [
                      {
                        value
                      }
                    ]
                  : null,
                placeholder
              }
            })
          }
        })
        break
      case ControlType.NUMBER:
        new Dialog({
          title: '数值控件',
          data: [
            {
              type: 'text',
              label: '占位符',
              name: 'placeholder',
              required: true,
              placeholder: '请输入占位符'
            },
            {
              type: 'text',
              label: '默认值',
              name: 'value',
              placeholder: '请输入默认值'
            }
          ],
          onConfirm: payload => {
            const placeholder = payload.find(
              p => p.name === 'placeholder'
            )?.value
            if (!placeholder) return
            const value = payload.find(p => p.name === 'value')?.value || ''
            instance.command.executeInsertControl({
              type: ElementType.CONTROL,
              value: '',
              control: {
                type,
                value: value
                  ? [
                      {
                        value
                      }
                    ]
                  : null,
                placeholder
              }
            })
          }
        })
        break
      default:
        break
    }
  }

  const checkboxDom = document.querySelector<HTMLDivElement>(
    '.menu-item__checkbox'
  )!
  checkboxDom.onclick = function () {
    console.log('checkbox')
    instance.command.executeInsertElementList([
      {
        type: ElementType.CHECKBOX,
        checkbox: {
          value: false
        },
        value: ''
      }
    ])
  }

  const radioDom = document.querySelector<HTMLDivElement>('.menu-item__radio')!
  radioDom.onclick = function () {
    console.log('radio')
    instance.command.executeInsertElementList([
      {
        type: ElementType.RADIO,
        checkbox: {
          value: false
        },
        value: ''
      }
    ])
  }

  const latexDom = document.querySelector<HTMLDivElement>('.menu-item__latex')!
  latexDom.onclick = function () {
    console.log('LaTeX')
    new Dialog({
      title: 'LaTeX',
      data: [
        {
          type: 'textarea',
          height: 100,
          name: 'value',
          placeholder: '请输入LaTeX文本'
        }
      ],
      onConfirm: payload => {
        const value = payload.find(p => p.name === 'value')?.value
        if (!value) return
        instance.command.executeInsertElementList([
          {
            type: ElementType.LATEX,
            value
          }
        ])
      }
    })
  }

  const dateDom = document.querySelector<HTMLDivElement>('.menu-item__date')!
  const dateDomOptionDom = dateDom.querySelector<HTMLDivElement>('.options')!
  dateDom.onclick = function () {
    console.log('date')
    dateDomOptionDom.classList.toggle('visible')
    // 定位调整
    const bodyRect = document.body.getBoundingClientRect()
    const dateDomOptionRect = dateDomOptionDom.getBoundingClientRect()
    if (dateDomOptionRect.left + dateDomOptionRect.width > bodyRect.width) {
      dateDomOptionDom.style.right = '0px'
      dateDomOptionDom.style.left = 'unset'
    } else {
      dateDomOptionDom.style.right = 'unset'
      dateDomOptionDom.style.left = '0px'
    }
    // 当前日期
    const date = new Date()
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    const second = date.getSeconds().toString().padStart(2, '0')
    const dateString = `${year}-${month}-${day}`
    const dateTimeString = `${dateString} ${hour}:${minute}:${second}`
    dateDomOptionDom.querySelector<HTMLLIElement>('li:first-child')!.innerText =
      dateString
    dateDomOptionDom.querySelector<HTMLLIElement>('li:last-child')!.innerText =
      dateTimeString
  }
  dateDomOptionDom.onmousedown = function (evt) {
    const li = evt.target as HTMLLIElement
    const dateFormat = li.dataset.format!
    dateDomOptionDom.classList.toggle('visible')
    instance.command.executeInsertElementList([
      {
        type: ElementType.DATE,
        value: '',
        dateFormat,
        valueList: [
          {
            value: li.innerText.trim()
          }
        ]
      }
    ])
  }

  const blockDom = document.querySelector<HTMLDivElement>('.menu-item__block')!
  blockDom.onclick = function () {
    console.log('block')
    new Dialog({
      title: '内容块',
      data: [
        {
          type: 'select',
          label: '类型',
          name: 'type',
          value: 'iframe',
          required: true,
          options: [
            {
              label: '网址',
              value: 'iframe'
            },
            {
              label: '视频',
              value: 'video'
            }
          ]
        },
        {
          type: 'number',
          label: '宽度',
          name: 'width',
          placeholder: '请输入宽度（默认页面内宽度）'
        },
        {
          type: 'number',
          label: '高度',
          name: 'height',
          required: true,
          placeholder: '请输入高度'
        },
        {
          type: 'input',
          label: '地址',
          name: 'src',
          required: false,
          placeholder: '请输入地址'
        },
        {
          type: 'textarea',
          label: 'HTML',
          height: 100,
          name: 'srcdoc',
          required: false,
          placeholder: '请输入HTML代码（仅网址类型有效）'
        }
      ],
      onConfirm: payload => {
        const type = payload.find(p => p.name === 'type')?.value
        if (!type) return
        const width = payload.find(p => p.name === 'width')?.value
        const height = payload.find(p => p.name === 'height')?.value
        if (!height) return
        // 地址或HTML代码至少存在一项
        const src = payload.find(p => p.name === 'src')?.value
        const srcdoc = payload.find(p => p.name === 'srcdoc')?.value
        const block: IBlock = {
          type: <BlockType>type
        }
        if (block.type === BlockType.IFRAME) {
          if (!src && !srcdoc) return
          block.iframeBlock = {
            src,
            srcdoc
          }
        } else if (block.type === BlockType.VIDEO) {
          if (!src) return
          block.videoBlock = {
            src
          }
        }
        const blockElement: IElement = {
          type: ElementType.BLOCK,
          value: '',
          height: Number(height),
          block
        }
        if (width) {
          blockElement.width = Number(width)
        }
        instance.command.executeInsertElementList([blockElement])
      }
    })
  }

  // 5. | 搜索&替换 | 打印 |
  const searchCollapseDom = document.querySelector<HTMLDivElement>(
    '.menu-item__search__collapse'
  )!
  const searchInputDom = document.querySelector<HTMLInputElement>(
    '.menu-item__search__collapse__search input'
  )!
  const replaceInputDom = document.querySelector<HTMLInputElement>(
    '.menu-item__search__collapse__replace input'
  )!
  const searchRegInputDom =
    document.querySelector<HTMLInputElement>('#option-reg')!
  const searchCaseInputDom =
    document.querySelector<HTMLInputElement>('#option-case')!
  const searchSelectionInputDom =
    document.querySelector<HTMLInputElement>('#option-selection')!
  const searchDom =
    document.querySelector<HTMLDivElement>('.menu-item__search')!
  searchDom.title = `搜索与替换(${isApple ? '⌘' : 'Ctrl'}+F)`
  const searchResultDom =
    searchCollapseDom.querySelector<HTMLLabelElement>('.search-result')!
  function setSearchResult() {
    const result = instance.command.getSearchNavigateInfo()
    if (result) {
      const { index, count } = result
      searchResultDom.innerText = `${index}/${count}`
    } else {
      searchResultDom.innerText = ''
    }
  }
  searchDom.onclick = function () {
    console.log('search')
    searchCollapseDom.style.display = 'block'
    const bodyRect = document.body.getBoundingClientRect()
    const searchRect = searchDom.getBoundingClientRect()
    const searchCollapseRect = searchCollapseDom.getBoundingClientRect()
    if (searchRect.left + searchCollapseRect.width > bodyRect.width) {
      searchCollapseDom.style.right = '0px'
      searchCollapseDom.style.left = 'unset'
    } else {
      searchCollapseDom.style.right = 'unset'
    }
    searchInputDom.focus()
  }
  searchCollapseDom.querySelector<HTMLSpanElement>('span')!.onclick =
    function () {
      searchCollapseDom.style.display = 'none'
      searchInputDom.value = ''
      replaceInputDom.value = ''
      instance.command.executeSearch(null)
      setSearchResult()
    }

  function emitSearch() {
    instance.command.executeSearch(searchInputDom.value || null, {
      isRegEnable: searchRegInputDom.checked,
      isIgnoreCase: searchCaseInputDom.checked,
      isLimitSelection: searchSelectionInputDom.checked
    })
    setSearchResult()
  }

  if (
    searchInputDom &&
    searchRegInputDom &&
    searchCaseInputDom &&
    searchSelectionInputDom
  ) {
    searchInputDom.oninput = emitSearch
    searchRegInputDom.onchange = emitSearch
    searchCaseInputDom.onchange = emitSearch
    searchSelectionInputDom.onchange = emitSearch
    searchInputDom.onkeydown = function (evt) {
      if (evt.key === 'Enter') {
        emitSearch()
      }
    }
  }
  searchCollapseDom.querySelector<HTMLButtonElement>('button')!.onclick =
    function () {
      const searchValue = searchInputDom.value
      const replaceValue = replaceInputDom.value
      if (searchValue && searchValue !== replaceValue) {
        instance.command.executeReplace(replaceValue)
      }
    }
  searchCollapseDom.querySelector<HTMLDivElement>('.arrow-left')!.onclick =
    function () {
      instance.command.executeSearchNavigatePre()
      setSearchResult()
    }
  searchCollapseDom.querySelector<HTMLDivElement>('.arrow-right')!.onclick =
    function () {
      instance.command.executeSearchNavigateNext()
      setSearchResult()
    }

  const printDom = document.querySelector<HTMLDivElement>('.menu-item__print')!
  printDom.title = `打印(${isApple ? '⌘' : 'Ctrl'}+P)`
  printDom.onclick = function () {
    console.log('print')
    instance.command.executePrint()
  }

  const exportPdfDom = document.querySelector<HTMLDivElement>(
    '.menu-item__export-pdf'
  )
  if (exportPdfDom) {
    exportPdfDom.title = '导出 PDF (.pdf)'
    exportPdfDom.onclick = function () {
      instance.command.executeExportPdf(getExportFileName('报告'))
    }
  }

  const exportWordDom = document.querySelector<HTMLDivElement>(
    '.menu-item__export-word'
  )
  if (exportWordDom) {
    exportWordDom.title = '导出 Word (.docx)'
    exportWordDom.onclick = function () {
      instance.command.executeExportDocx({
        fileName: getExportFileName('报告')
      })
    }
  }

  // 6. 目录显隐 | 页面模式 | 纸张缩放 | 纸张大小 | 纸张方向 | 页边距 | 全屏 | 设置
  const editorOptionDom =
    document.querySelector<HTMLDivElement>('.editor-option')!
  editorOptionDom.onclick = function () {
    const options = instance.command.getOptions()
    new Dialog({
      title: '编辑器配置',
      data: [
        {
          type: 'textarea',
          name: 'option',
          width: 350,
          height: 300,
          required: true,
          value: JSON.stringify(options, null, 2),
          placeholder: '请输入编辑器配置'
        }
      ],
      onConfirm: payload => {
        const newOptionValue = payload.find(p => p.name === 'option')?.value
        if (!newOptionValue) return
        const newOption = JSON.parse(newOptionValue)
        instance.command.executeUpdateOptions(newOption)
      }
    })
  }

  async function updateCatalog() {
    const catalog = await instance.command.getCatalog()
    const catalogMainDom =
      document.querySelector<HTMLDivElement>('.catalog__main')!
    catalogMainDom.innerHTML = ''
    if (catalog) {
      const appendCatalog = (
        parent: HTMLDivElement,
        catalogItems: ICatalogItem[]
      ) => {
        for (let c = 0; c < catalogItems.length; c++) {
          const catalogItem = catalogItems[c]
          const catalogItemDom = document.createElement('div')
          catalogItemDom.classList.add('catalog-item')
          // 渲染
          const catalogItemContentDom = document.createElement('div')
          catalogItemContentDom.classList.add('catalog-item__content')
          const catalogItemContentSpanDom = document.createElement('span')
          catalogItemContentSpanDom.innerText = catalogItem.name
          catalogItemContentDom.append(catalogItemContentSpanDom)
          // 定位
          catalogItemContentDom.onclick = () => {
            instance.command.executeLocationCatalog(catalogItem.id)
          }
          catalogItemDom.append(catalogItemContentDom)
          if (catalogItem.subCatalog && catalogItem.subCatalog.length) {
            appendCatalog(catalogItemDom, catalogItem.subCatalog)
          }
          // 追加
          parent.append(catalogItemDom)
        }
      }
      appendCatalog(catalogMainDom, catalog)
    }
  }
  // 窄屏 / 笔记本视口下默认折叠目录
  let isCatalogShow = window.innerWidth > 1440
  const catalogDom = document.querySelector<HTMLElement>('.catalog')!
  if (catalogDom) {
    catalogDom.classList.toggle('hidden', !isCatalogShow)
    catalogDom.classList.toggle('open', isCatalogShow)
  }
  const catalogModeDom =
    document.querySelector<HTMLDivElement>('.catalog-mode')!
  const catalogHeaderCloseDom = document.querySelector<HTMLDivElement>(
    '.catalog__header__close'
  )!
  const switchCatalog = () => {
    isCatalogShow = !isCatalogShow
    catalogDom.classList.toggle('hidden', !isCatalogShow)
    catalogDom.classList.toggle('open', isCatalogShow)
    if (isCatalogShow) {
      updateCatalog()
    }
  }
  if (catalogModeDom) catalogModeDom.onclick = switchCatalog
  if (catalogHeaderCloseDom) catalogHeaderCloseDom.onclick = switchCatalog

  const pageModeDom = document.querySelector<HTMLDivElement>('.page-mode')!
  const pageModeOptionsDom =
    pageModeDom.querySelector<HTMLDivElement>('.options')!
  pageModeDom.onclick = function () {
    pageModeOptionsDom.classList.toggle('visible')
  }
  pageModeOptionsDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    instance.command.executePageMode(<PageMode>li.dataset.pageMode!)
  }

  const pageScaleTextDom = document.querySelector<HTMLSpanElement>(
    '.page-scale-percentage'
  )!
  const updatePageScaleText = (scale: number) => {
    if (pageScaleTextDom) {
      pageScaleTextDom.innerText = `${Math.round(scale * 100)}%`
    }
  }
  // 初始化渲染缓存中的缩放比例文本
  updatePageScaleText(instance.command.getOptions().scale)

  // 监听画布缩放比例变化，同步回显文本
  instance.listener.pageScaleChange = function (payload) {
    updatePageScaleText(payload)
  }

  pageScaleTextDom.onclick = function () {
    console.log('page-scale-recovery')
    instance.command.executePageScaleRecovery()
  }

  document.querySelector<HTMLDivElement>('.page-scale-minus')!.onclick =
    function () {
      console.log('page-scale-minus')
      instance.command.executePageScaleMinus()
    }

  document.querySelector<HTMLDivElement>('.page-scale-add')!.onclick =
    function () {
      console.log('page-scale-add')
      instance.command.executePageScaleAdd()
    }

  // 纸张大小
  const paperSizeDom = document.querySelector<HTMLDivElement>('.paper-size')!
  const paperSizeDomOptionsDom =
    paperSizeDom.querySelector<HTMLDivElement>('.options')!
  paperSizeDom.onclick = function () {
    paperSizeDomOptionsDom.classList.toggle('visible')
  }
  paperSizeDomOptionsDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    const paperType = li.dataset.paperSize!
    const [width, height] = paperType.split('*').map(Number)
    instance.command.executePaperSize(width, height)
    // 纸张状态回显
    paperSizeDomOptionsDom
      .querySelectorAll('li')
      .forEach(child => child.classList.remove('active'))
    li.classList.add('active')
  }

  // 纸张方向
  const paperDirectionDom =
    document.querySelector<HTMLDivElement>('.paper-direction')!
  const paperDirectionDomOptionsDom =
    paperDirectionDom.querySelector<HTMLDivElement>('.options')!
  paperDirectionDom.onclick = function () {
    paperDirectionDomOptionsDom.classList.toggle('visible')
  }
  paperDirectionDomOptionsDom.onclick = function (evt) {
    const li = evt.target as HTMLLIElement
    const paperDirection = li.dataset.paperDirection!
    instance.command.executePaperDirection(<PaperDirection>paperDirection)
    // 纸张方向状态回显
    paperDirectionDomOptionsDom
      .querySelectorAll('li')
      .forEach(child => child.classList.remove('active'))
    li.classList.add('active')
  }

  // 页面边距
  const paperMarginDom =
    document.querySelector<HTMLDivElement>('.paper-margin')!
  paperMarginDom.onclick = function () {
    const [topMargin, rightMargin, bottomMargin, leftMargin] =
      instance.command.getPaperMargin()
    new Dialog({
      title: '页边距',
      data: [
        {
          type: 'text',
          label: '上边距',
          name: 'top',
          required: true,
          value: `${topMargin}`,
          placeholder: '请输入上边距'
        },
        {
          type: 'text',
          label: '下边距',
          name: 'bottom',
          required: true,
          value: `${bottomMargin}`,
          placeholder: '请输入下边距'
        },
        {
          type: 'text',
          label: '左边距',
          name: 'left',
          required: true,
          value: `${leftMargin}`,
          placeholder: '请输入左边距'
        },
        {
          type: 'text',
          label: '右边距',
          name: 'right',
          required: true,
          value: `${rightMargin}`,
          placeholder: '请输入右边距'
        }
      ],
      onConfirm: payload => {
        const top = payload.find(p => p.name === 'top')?.value
        if (!top) return
        const bottom = payload.find(p => p.name === 'bottom')?.value
        if (!bottom) return
        const left = payload.find(p => p.name === 'left')?.value
        if (!left) return
        const right = payload.find(p => p.name === 'right')?.value
        if (!right) return
        instance.command.executeSetPaperMargin([
          Number(top),
          Number(right),
          Number(bottom),
          Number(left)
        ])
      }
    })
  }

  // 分栏配置
  const columnConfigDom =
    document.querySelector<HTMLDivElement>('.column-config')!
  columnConfigDom.onclick = function () {
    const current = instance.command.getColumns()
    const count = current?.count ?? 1
    const gap = current?.gap ?? 20
    const separator = current?.separator ? 'true' : 'false'
    new Dialog({
      title: '分栏',
      data: [
        {
          type: 'select',
          label: '栏数',
          name: 'count',
          required: true,
          value: `${count}`,
          options: [
            { value: '1', label: '1（关闭）' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '5', label: '5' }
          ]
        },
        {
          type: 'text',
          label: '栏间距',
          name: 'gap',
          required: true,
          value: `${gap}`,
          placeholder: '请输入栏间距（像素）'
        },
        {
          type: 'select',
          label: '分隔线',
          name: 'separator',
          required: true,
          value: separator,
          options: [
            { value: 'false', label: '不显示' },
            { value: 'true', label: '显示' }
          ]
        }
      ],
      onConfirm: payload => {
        const countValue = payload.find(p => p.name === 'count')?.value
        if (!countValue) return
        const gapValue = payload.find(p => p.name === 'gap')?.value
        if (!gapValue) return
        const separatorValue = payload.find(p => p.name === 'separator')?.value
        if (!separatorValue) return
        instance.command.executeSetColumns({
          count: Number(countValue),
          gap: Number(gapValue),
          separator: separatorValue === 'true'
        })
      }
    })
  }

  // 全屏
  const fullscreenDom = document.querySelector<HTMLDivElement>('.fullscreen')!
  fullscreenDom.onclick = toggleFullscreen
  window.addEventListener('keydown', evt => {
    if (evt.key === 'F11') {
      toggleFullscreen()
      evt.preventDefault()
    }
  })
  document.addEventListener('fullscreenchange', () => {
    fullscreenDom.classList.toggle('exist')
  })
  function toggleFullscreen() {
    console.log('fullscreen')
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // 7. 编辑器使用模式
  const modeList = [
    {
      mode: EditorMode.EDIT,
      name: '编辑模式'
    },
    {
      mode: EditorMode.PREVIEW_EDIT,
      name: '无痕编辑'
    },
    {
      mode: EditorMode.CLEAN,
      name: '清洁模式'
    },
    {
      mode: EditorMode.READONLY,
      name: '只读模式'
    },
    {
      mode: EditorMode.FORM,
      name: '表单模式'
    },
    {
      mode: EditorMode.PRINT,
      name: '打印模式'
    },
    {
      mode: EditorMode.DESIGN,
      name: '设计模式'
    },
    {
      mode: EditorMode.GRAFFITI,
      name: '涂鸦模式'
    },
    {
      mode: EditorMode.TRACE,
      name: '留痕模式'
    }
  ]
  const modeElement = document.querySelector<HTMLDivElement>('.editor-mode')!
  const modeOptionsElement =
    modeElement.querySelector<HTMLUListElement>('.options')!
  const modeTextElement = modeElement.querySelector<HTMLSpanElement>('.text')!
  const modeTextMap = modeList.reduce<Record<string, string>>((acc, item) => {
    acc[item.mode] = item.name
    return acc
  }, {})
  // 初始 active 与 .text 对齐当前模式
  const currentMode = instance.command.getOptions().mode
  modeTextElement.innerText =
    modeTextMap[currentMode] || modeTextMap[EditorMode.EDIT]
  modeOptionsElement.querySelectorAll<HTMLLIElement>('li').forEach(li => {
    li.classList.toggle('active', li.dataset.mode === currentMode)
  })

  // 留痕记录开关（仅 "留痕模式" 行可见；留痕查看模式下禁用）
  const traceToggleDom = document.querySelector<HTMLInputElement>(
    '.trace-toggle__input'
  )!
  traceToggleDom.checked = !instance.command.getOptions().trace?.disabled
  traceToggleDom.disabled = currentMode === EditorMode.TRACE
  traceToggleDom.onchange = function () {
    instance.command.executeToggleTrace(traceToggleDom.checked)
  }

  const applyMode = (mode: string) => {
    modeTextElement.innerText = modeTextMap[mode] || mode
    const asidePanelDom = document.querySelector<HTMLDivElement>(
      '#editor-aside-right'
    )
    const asideToggleDom =
      document.querySelector<HTMLDivElement>('#aside-toggle')

    instance.command.executeMode(mode as EditorMode)

    // 右侧占位符面板:仅编辑/设计模式自动显示,其他模式默认隐藏
    // (宿主显式关闭面板功能走 setCustomConfig 的 features.asidePanel 开关)
    const isPanelMode = mode === EditorMode.EDIT || mode === EditorMode.DESIGN
    if (isPanelMode) {
      asidePanelDom?.classList.remove('hidden')
      if (asideToggleDom) asideToggleDom.style.display = 'flex'
    } else {
      asidePanelDom?.classList.add('hidden')
      if (asideToggleDom) asideToggleDom.style.display = 'none'
    }
    // 上报宿主模式变更(宿主可据此同步自身 UI 状态)
    bridge.notifyModeChange(mode)

    // 更新 active 高亮
    modeOptionsElement.querySelectorAll<HTMLLIElement>('li').forEach(li => {
      li.classList.toggle('active', li.dataset.mode === mode)
    })
    // 设置菜单栏权限视觉反馈
    const isReadonly = mode === EditorMode.READONLY || mode === EditorMode.TRACE
    const enableMenuList = ['search', 'print']
    document.querySelectorAll<HTMLDivElement>('.menu-item>div').forEach(dom => {
      const menu = dom.dataset.menu
      isReadonly && (!menu || !enableMenuList.includes(menu))
        ? dom.classList.add('disable')
        : dom.classList.remove('disable')
    })
    // 留痕查看模式禁止切回记录态
    traceToggleDom.disabled = mode === EditorMode.TRACE
  }
  modeElement.onclick = function (evt) {
    if (!activeFeatureConfig.modeSwitch) return
    // 点击 li 时不重复 toggle 弹窗（交由 options 处理）
    if ((evt.target as HTMLElement).tagName === 'LI') return
    modeOptionsElement.classList.toggle('visible')
  }
  modeOptionsElement.onclick = function (evt) {
    if (!activeFeatureConfig.modeSwitch) return
    const target = evt.target as HTMLElement
    if (target.closest('.trace-toggle')) return
    const li = target.closest('li')
    if (!li) return
    const mode = li.dataset.mode as EditorMode
    if (!modeTextMap[mode]) return
    applyMode(mode)
    modeOptionsElement.classList.remove('visible')
  }

  // 模拟批注
  const commentDom = document.querySelector<HTMLDivElement>('.comment')!
  async function updateComment() {
    const groupIds = await instance.command.getGroupIds()
    for (const comment of commentList) {
      const activeCommentDom = commentDom.querySelector<HTMLDivElement>(
        `.comment-item[data-id='${comment.id}']`
      )
      // 编辑器是否存在对应成组id
      if (groupIds.includes(comment.id)) {
        // 当前dom是否存在-不存在则追加
        if (!activeCommentDom) {
          const commentItem = document.createElement('div')
          commentItem.classList.add('comment-item')
          commentItem.setAttribute('data-id', comment.id)
          commentItem.onclick = () => {
            instance.command.executeLocationGroup(comment.id)
          }
          commentDom.append(commentItem)
          // 选区信息
          const commentItemTitle = document.createElement('div')
          commentItemTitle.classList.add('comment-item__title')
          commentItemTitle.append(document.createElement('span'))
          const commentItemTitleContent = document.createElement('span')
          commentItemTitleContent.innerText = comment.rangeText
          commentItemTitle.append(commentItemTitleContent)
          const closeDom = document.createElement('i')
          closeDom.onclick = () => {
            instance.command.executeDeleteGroup(comment.id)
          }
          commentItemTitle.append(closeDom)
          commentItem.append(commentItemTitle)
          // 基础信息
          const commentItemInfo = document.createElement('div')
          commentItemInfo.classList.add('comment-item__info')
          const commentItemInfoName = document.createElement('span')
          commentItemInfoName.innerText = comment.userName
          const commentItemInfoDate = document.createElement('span')
          commentItemInfoDate.innerText = comment.createdDate
          commentItemInfo.append(commentItemInfoName)
          commentItemInfo.append(commentItemInfoDate)
          commentItem.append(commentItemInfo)
          // 详细评论
          const commentItemContent = document.createElement('div')
          commentItemContent.classList.add('comment-item__content')
          commentItemContent.innerText = comment.content
          commentItem.append(commentItemContent)
          commentDom.append(commentItem)
        }
      } else {
        // 编辑器内不存在对应成组id则dom则移除
        activeCommentDom?.remove()
      }
    }
  }
  // 8. 内部事件监听
  instance.listener.rangeStyleChange = function (payload) {
    // 控件类型
    payload.type === ElementType.SUBSCRIPT
      ? subscriptDom.classList.add('active')
      : subscriptDom.classList.remove('active')
    payload.type === ElementType.SUPERSCRIPT
      ? superscriptDom.classList.add('active')
      : superscriptDom.classList.remove('active')
    payload.type === ElementType.SEPARATOR
      ? separatorDom.classList.add('active')
      : separatorDom.classList.remove('active')
    separatorOptionDom
      .querySelectorAll('li')
      .forEach(li => li.classList.remove('active'))
    if (payload.type === ElementType.SEPARATOR) {
      const separator = payload.dashArray.join(',') || '0,0'
      const curSeparatorDom = separatorOptionDom.querySelector<HTMLLIElement>(
        `[data-separator='${separator}']`
      )!
      if (curSeparatorDom) {
        curSeparatorDom.classList.add('active')
      }
    }

    // 富文本
    fontOptionDom
      .querySelectorAll<HTMLLIElement>('li')
      .forEach(li => li.classList.remove('active'))
    const curFontDom = fontOptionDom.querySelector<HTMLLIElement>(
      `[data-family='${payload.font}']`
    )
    if (curFontDom) {
      fontSelectDom.innerText = curFontDom.innerText
      fontSelectDom.style.fontFamily = payload.font
      curFontDom.classList.add('active')
    }
    sizeOptionDom
      .querySelectorAll<HTMLLIElement>('li')
      .forEach(li => li.classList.remove('active'))
    const curSizeDom = sizeOptionDom.querySelector<HTMLLIElement>(
      `[data-size='${payload.size}']`
    )
    if (curSizeDom) {
      sizeSelectDom.innerText = curSizeDom.innerText
      curSizeDom.classList.add('active')
    } else {
      sizeSelectDom.innerText = `${payload.size}`
    }
    payload.bold
      ? boldDom.classList.add('active')
      : boldDom.classList.remove('active')
    payload.italic
      ? italicDom.classList.add('active')
      : italicDom.classList.remove('active')
    payload.underline
      ? underlineDom.classList.add('active')
      : underlineDom.classList.remove('active')
    payload.strikeout
      ? strikeoutDom.classList.add('active')
      : strikeoutDom.classList.remove('active')
    if (payload.color) {
      colorDom.classList.add('active')
      colorControlDom.value = payload.color
      colorSpanDom.style.backgroundColor = payload.color
    } else {
      colorDom.classList.remove('active')
      colorControlDom.value = '#000000'
      colorSpanDom.style.backgroundColor = '#000000'
    }
    if (payload.highlight) {
      highlightDom.classList.add('active')
      highlightControlDom.value = payload.highlight
      highlightSpanDom.style.backgroundColor = payload.highlight
    } else {
      highlightDom.classList.remove('active')
      highlightControlDom.value = '#ffff00'
      highlightSpanDom.style.backgroundColor = '#ffff00'
    }

    // 行布局
    leftDom.classList.remove('active')
    centerDom.classList.remove('active')
    rightDom.classList.remove('active')
    alignmentDom.classList.remove('active')
    justifyDom.classList.remove('active')
    if (payload.rowFlex && payload.rowFlex === 'right') {
      rightDom.classList.add('active')
    } else if (payload.rowFlex && payload.rowFlex === 'center') {
      centerDom.classList.add('active')
    } else if (payload.rowFlex && payload.rowFlex === 'alignment') {
      alignmentDom.classList.add('active')
    } else if (payload.rowFlex && payload.rowFlex === 'justify') {
      justifyDom.classList.add('active')
    } else {
      leftDom.classList.add('active')
    }

    // 行间距
    rowOptionDom
      .querySelectorAll<HTMLLIElement>('li')
      .forEach(li => li.classList.remove('active'))
    const curRowMarginDom = rowOptionDom.querySelector<HTMLLIElement>(
      `[data-rowmargin='${payload.rowMargin}']`
    )!
    curRowMarginDom.classList.add('active')

    // 功能
    payload.undo
      ? undoDom.classList.remove('no-allow')
      : undoDom.classList.add('no-allow')
    payload.redo
      ? redoDom.classList.remove('no-allow')
      : redoDom.classList.add('no-allow')
    payload.painter
      ? painterDom.classList.add('active')
      : painterDom.classList.remove('active')

    // 标题
    const titleItems = titleContainerDom.querySelectorAll<HTMLDivElement>(
      '.title-gallery__item'
    )
    titleItems.forEach(item => item.classList.remove('active'))
    const curLevel = payload.level || ''
    const activeTitleItem = titleContainerDom.querySelector<HTMLDivElement>(
      `.title-gallery__item[data-level='${curLevel}']`
    )
    if (activeTitleItem) {
      activeTitleItem.classList.add('active')
    } else {
      const firstItem = titleContainerDom.querySelector<HTMLDivElement>(
        '.title-gallery__item[data-level=""]'
      )
      if (firstItem) firstItem.classList.add('active')
    }

    // 列表
    listOptionDom
      .querySelectorAll<HTMLLIElement>('li')
      .forEach(li => li.classList.remove('active'))
    if (payload.listType) {
      listDom.classList.add('active')
      const listType = payload.listType
      const listStyle =
        payload.listType === ListType.OL ? ListStyle.DECIMAL : payload.listType
      const curListDom = listOptionDom.querySelector<HTMLLIElement>(
        `[data-list-type='${listType}'][data-list-style='${listStyle}']`
      )
      if (curListDom) {
        curListDom.classList.add('active')
      }
    } else {
      listDom.classList.remove('active')
    }

    // 批注
    commentDom
      .querySelectorAll<HTMLDivElement>('.comment-item')
      .forEach(commentItemDom => {
        commentItemDom.classList.remove('active')
      })
    if (payload.groupIds) {
      const [id] = payload.groupIds
      const activeCommentDom = commentDom.querySelector<HTMLDivElement>(
        `.comment-item[data-id='${id}']`
      )
      if (activeCommentDom) {
        activeCommentDom.classList.add('active')
        scrollIntoView(commentDom, activeCommentDom)
      }
    }

    // 行列信息
    const rangeContext = instance.command.getRangeContext()
    if (rangeContext) {
      document.querySelector<HTMLSpanElement>('.row-no')!.innerText = `${
        rangeContext.startRowNo + 1
      }`
      document.querySelector<HTMLSpanElement>('.col-no')!.innerText = `${
        rangeContext.startColNo + 1
      }`
    }
  }

  instance.listener.visiblePageNoListChange = function (payload) {
    const text = payload.map(i => i + 1).join('、')
    document.querySelector<HTMLSpanElement>('.page-no-list')!.innerText = text
  }

  instance.listener.pageSizeChange = function (payload) {
    document.querySelector<HTMLSpanElement>('.page-size')!.innerText =
      `${payload}`
  }

  instance.listener.intersectionPageNoChange = function (payload) {
    document.querySelector<HTMLSpanElement>('.page-no')!.innerText = `${
      payload + 1
    }`
  }

  instance.listener.pageScaleChange = function (payload) {
    document.querySelector<HTMLSpanElement>(
      '.page-scale-percentage'
    )!.innerText = `${Math.floor(payload * 10 * 10)}%`
  }

  instance.listener.controlChange = function (payload) {
    const disableMenusInControlContext = [
      'table',
      'hyperlink',
      'separator',
      'page-break',
      'control'
    ]
    // 菜单操作权限
    disableMenusInControlContext.forEach(menu => {
      const menuDom = document.querySelector<HTMLDivElement>(
        `.menu-item__${menu}`
      )!
      payload.state === ControlState.ACTIVE
        ? menuDom.classList.add('disable')
        : menuDom.classList.remove('disable')
    })
  }

  instance.listener.pageModeChange = function (payload) {
    const activeMode = pageModeOptionsDom.querySelector<HTMLLIElement>(
      `[data-page-mode='${payload}']`
    )!
    pageModeOptionsDom
      .querySelectorAll('li')
      .forEach(li => li.classList.remove('active'))
    activeMode.classList.add('active')
  }

  const handleContentChange = async function () {
    // 字数
    const wordCount = await instance.command.getWordCount()
    document.querySelector<HTMLSpanElement>('.word-count')!.innerText = `${
      wordCount || 0
    }`
    // 目录
    if (isCatalogShow) {
      nextTick(() => {
        updateCatalog()
      })
    }
    // 批注
    nextTick(() => {
      updateComment()
    })
    // 代理通知宿主事件
    bridge.notifyEvent('contentChange', { wordCount })
  }
  instance.listener.contentChange = debounce(handleContentChange, 200)
  handleContentChange()

  instance.listener.controlChange = function (payload) {
    bridge.notifyEvent('controlChange', payload)
  }

  // 9. 右键菜单注册
  // 宏：从 localStorage 恢复已保存的宏
  const MACRO_STORAGE_KEY = 'canvas-editor:macros'
  const saved = localStorage.getItem(MACRO_STORAGE_KEY)
  if (saved) {
    instance.macro.importMacros(saved)
  }

  instance.register.contextMenuList([
    {
      name: '批注',
      when: payload => {
        return (
          activeFeatureConfig.comment &&
          !payload.isReadonly &&
          payload.editorHasSelection &&
          payload.zone === EditorZone.MAIN
        )
      },
      callback: (command: Command) => {
        new Dialog({
          title: '批注',
          data: [
            {
              type: 'textarea',
              label: '批注',
              height: 100,
              name: 'value',
              required: true,
              placeholder: '请输入批注'
            }
          ],
          onConfirm: payload => {
            const value = payload.find(p => p.name === 'value')?.value
            if (!value) return
            const groupId = command.executeSetGroup()
            if (!groupId) return
            commentList.push({
              id: groupId,
              content: value,
              userName: 'Hufe',
              rangeText: command.getRangeText(),
              createdDate: new Date().toLocaleString()
            })
          }
        })
      }
    },
    {
      name: '新增题注',
      icon: 'caption',
      when: payload => {
        return (
          !payload.isReadonly &&
          payload.startElement?.type === ElementType.IMAGE &&
          !payload.startElement?.imgCaption
        )
      },
      callback: (command: Command) => {
        new Dialog({
          title: '新增题注',
          data: [
            {
              type: 'text',
              label: '题注内容',
              name: 'value',
              required: true,
              placeholder: '请输入题注内容，使用{imageNo}表示图片序号'
            }
          ],
          onConfirm: payload => {
            const value = payload.find(p => p.name === 'value')?.value
            if (!value) return
            command.executeSetImageCaption({
              value
            })
          }
        })
      }
    },
    {
      name: '修改题注',
      icon: 'caption',
      when: payload => {
        return (
          !payload.isReadonly &&
          payload.startElement?.type === ElementType.IMAGE &&
          !!payload.startElement?.imgCaption
        )
      },
      callback: (command: Command, context) => {
        const currentCaption = context.startElement?.imgCaption
        new Dialog({
          title: '修改题注',
          data: [
            {
              type: 'text',
              label: '题注内容',
              name: 'value',
              required: true,
              value: currentCaption?.value,
              placeholder: '请输入题注内容，使用{imageNo}表示图片序号'
            }
          ],
          onConfirm: payload => {
            const value = payload.find(p => p.name === 'value')?.value
            command.executeSetImageCaption({
              ...currentCaption,
              value: value || ''
            })
          }
        })
      }
    },
    {
      name: '签名',
      icon: 'signature',
      when: payload => {
        return (
          activeFeatureConfig.signature &&
          !payload.isReadonly &&
          payload.editorTextFocus
        )
      },
      callback: (command: Command) => {
        new Signature({
          async onConfirm(payload) {
            if (!payload) return
            const { value, width, height } = payload
            if (!value || !width || !height) return
            // 通过宿主 uploadImage Hook 异步将 base64 上传为在线 https OSS 地址
            let imageUrl: any = await bridge.notifyUploadImage(value)
            if (typeof imageUrl !== 'string') {
              imageUrl = imageUrl?.data || imageUrl?.url || ''
            }
            command.executeInsertElementList([
              {
                value: imageUrl,
                width,
                height,
                type: ElementType.IMAGE
              }
            ])
          }
        })
      }
    },
    {
      name: '格式整理',
      icon: 'import',
      when: payload => {
        return !payload.isReadonly
      },
      callback: (command: Command) => {
        command.executeWordTool()
      }
    },
    {
      name: '清空涂鸦信息',
      when: payload => {
        return payload.options.mode === EditorMode.GRAFFITI
      },
      callback: (command: Command) => {
        command.executeClearGraffiti()
      }
    },
    {
      name: '宏',
      when: payload => activeFeatureConfig.macro && !payload.isReadonly,
      childMenus: [
        {
          name: '录制宏',
          icon: 'record',
          when: () => !instance.macro.isRecording(),
          callback: () => {
            instance.macro.startRecording()
          }
        },
        {
          name: '停止录制宏',
          icon: 'stop',
          when: () => instance.macro.isRecording(),
          callback: () => {
            new Dialog({
              title: '保存宏',
              data: [
                {
                  type: 'text',
                  label: '宏名称',
                  name: 'name',
                  required: true,
                  placeholder: '请输入宏名称'
                }
              ],
              onConfirm: payload => {
                const name = payload.find(p => p.name === 'name')?.value
                if (!name) return
                const macro = instance.macro.stopRecording(name)
                if (!macro) return
                localStorage.setItem(
                  MACRO_STORAGE_KEY,
                  instance.macro.exportMacros()
                )
              },
              onCancel: () => {
                instance.macro.cancelRecording()
              }
            })
          }
        },
        {
          name: '回放宏',
          when: () =>
            !instance.macro.isRecording() &&
            instance.macro.getMacros().length > 0,
          callback: () => {
            const macros = instance.macro.getMacros()
            new Dialog({
              title: '回放宏',
              data: [
                {
                  type: 'select',
                  label: '选择宏',
                  name: 'macroId',
                  required: true,
                  options: macros.map(m => ({
                    label: `${m.name} (${m.type})`,
                    value: m.id
                  }))
                }
              ],
              onConfirm: async payload => {
                const id = payload.find(p => p.name === 'macroId')?.value
                if (!id) return
                await instance.macro.play(id)
              }
            })
          }
        },
        {
          name: '管理宏',
          when: () =>
            !instance.macro.isRecording() &&
            instance.macro.getMacros().length > 0,
          callback: () => {
            const macros = instance.macro.getMacros()
            new Dialog({
              title: '管理宏',
              data: [
                {
                  type: 'select',
                  label: '选择要删除的宏',
                  name: 'macroId',
                  options: macros.map(m => ({
                    label: `${m.name} (${m.type})`,
                    value: m.id
                  }))
                }
              ],
              onConfirm: payload => {
                const id = payload.find(p => p.name === 'macroId')?.value
                if (!id) return
                if (instance.macro.removeMacro(id)) {
                  localStorage.setItem(
                    MACRO_STORAGE_KEY,
                    instance.macro.exportMacros()
                  )
                }
              }
            })
          }
        }
      ]
    }
  ])

  // 10. 快捷键注册
  instance.register.shortcutList([
    {
      key: KeyMap.P,
      mod: true,
      isGlobal: true,
      callback: (command: Command) => {
        command.executePrint()
      }
    },
    {
      key: KeyMap.F,
      mod: true,
      isGlobal: true,
      callback: (command: Command) => {
        const text = command.getRangeText()
        searchDom.click()
        if (text) {
          searchInputDom.value = text
          instance.command.executeSearch(text)
          setSearchResult()
        }
      }
    },
    {
      key: KeyMap.MINUS,
      ctrl: true,
      isGlobal: true,
      callback: (command: Command) => {
        command.executePageScaleMinus()
      }
    },
    {
      key: KeyMap.EQUAL,
      ctrl: true,
      isGlobal: true,
      callback: (command: Command) => {
        command.executePageScaleAdd()
      }
    },
    {
      key: KeyMap.ZERO,
      ctrl: true,
      isGlobal: true,
      callback: (command: Command) => {
        command.executePageScaleRecovery()
      }
    }
  ])

  // 顶部菜单栏：支持鼠标滚轮平滑横向滚动 (当宽度超出时)
  const menuDom = document.querySelector<HTMLDivElement>('.menu')
  if (menuDom) {
    menuDom.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (menuDom.scrollWidth > menuDom.clientWidth) {
          e.preventDefault()
          menuDom.scrollLeft += e.deltaY || e.deltaX
        }
      },
      { passive: false }
    )
  }

  // -------------------------------------------------------------
  // 31. 右侧侧边栏组件库 (Data Components) 交互
  // -------------------------------------------------------------
  const asideContainer = document.querySelector<HTMLDivElement>(
    '#aside-component-list'
  )
  const asidePanelDom = document.querySelector<HTMLDivElement>(
    '#editor-aside-right'
  )
  const asideToggleDom = document.querySelector<HTMLDivElement>('#aside-toggle')
  const asideCloseBtnDom =
    document.querySelector<HTMLElement>('#aside-close-btn')
  const asideViewDataBtnDom = document.querySelector<HTMLButtonElement>(
    '#aside-view-data-btn'
  )

  let currentComponentsData: any[] = []

  // 面板字段类型 → 图标标识文字
  const COMPONENT_TYPE_ICON: Record<string, string> = {
    text: 'text',
    number: 'number',
    date: 'date',
    image: 'image',
    select: 'select',
    checkbox: 'checkbox',
    radio: 'radio',
    list: 'list',
    array: 'array',
    object: 'object'
  }

  // 面板字段类型 → 编辑器控件类型
  const COMPONENT_CONTROL_TYPE_MAP: Record<string, ControlType> = {
    text: ControlType.TEXT,
    number: ControlType.NUMBER,
    date: ControlType.DATE,
    image: ControlType.IMAGE,
    select: ControlType.SELECT,
    checkbox: ControlType.CHECKBOX,
    radio: ControlType.RADIO,
    list: ControlType.TEXT
  }

  // 拼接字段完整取值路径（直接使用字段自身的 fieldKey/conceptId/path）
  const buildFieldPath = (comp: any): string => {
    return comp.fieldKey || comp.conceptId || comp.path || comp.key || ''
  }

  // 构建插入控件的 control 配置（含 select/checkbox/radio 的 valueSets 与图片占位宽高）
  const buildFieldControl = (
    comp: any,
    _pathStack?: string[],
    conceptIdOverride?: string
  ): any => {
    const fType = (comp.fieldType || comp.type || 'text').toLowerCase()
    const fName =
      comp.fieldName ||
      comp.name ||
      comp.label ||
      comp.fieldKey ||
      comp.conceptId ||
      '字段'
    const finalConceptId = conceptIdOverride || buildFieldPath(comp)

    const control: Record<string, any> = {
      conceptId: finalConceptId,
      type: COMPONENT_CONTROL_TYPE_MAP[fType] || ControlType.TEXT,
      placeholder: fName,
      value: null
    }

    if (fType === 'list') {
      const listType = (comp.listType || 'text').toLowerCase()
      control.listType = listType
      control.layout = comp.layout || 'vertical'
      control.gridCols = Number(comp.gridCols) || 2
      if (listType === 'radio') {
        control.type = ControlType.RADIO
        control.code = null
      } else if (listType === 'checkbox') {
        control.type = ControlType.CHECKBOX
        control.code = null
      } else if (listType === 'image') {
        control.type = ControlType.IMAGE
        control.width = comp.width || 80
        control.height = comp.height || 80
      } else {
        control.type = ControlType.TEXT
      }
    }

    if (fType === 'image') {
      control.width = comp.width || 120
      control.height = comp.height || 120
    }
    if (fType === 'date') {
      control.dateFormat = comp.dateFormat
    }
    if (
      fType === 'select' ||
      fType === 'checkbox' ||
      fType === 'radio'
    ) {
      control.code = null
      const opts = comp.options || comp.children || []
      const isVertical =
        comp.isVertical === true ||
        comp.layout === 'vertical' ||
        comp.direction === 'vertical'
      const isGrid = comp.layout === 'grid'
      const gridCols = Number(comp.gridCols) || 2

      if (opts.length > 0) {
        control.valueSets = opts.map((opt: any, optIdx: number) => {
          let labelText =
            opt.label != null
              ? String(opt.label)
              : opt.name != null
                ? String(opt.name)
                : opt.fieldName != null
                  ? String(opt.fieldName)
                  : String(opt.value ?? opt.fieldKey ?? '')
          const shouldWrap =
            (isVertical && optIdx < opts.length - 1) ||
            (isGrid && (optIdx + 1) % gridCols === 0 && optIdx < opts.length - 1)

          if (shouldWrap && !labelText.endsWith('\n')) {
            labelText += '\n'
          }
          return {
            value: labelText,
            code: String(
              opt.value != null
                ? opt.value
                : opt.fieldKey || opt.code || opt.id || ''
            )
          }
        })
      }
    }
    return control
  }

  // -------------------------------------------------------------
  // 31.0 计算编辑器正文 100% 可用宽度
  // -------------------------------------------------------------
  const getAvailableEditorWidth = (): number => {
    try {
      const options =
        (instance.command as any).getOptions?.() ||
        (instance as any).options ||
        {}
      const pageWidth = options.width || 794
      const margins = options.margins || [100, 120, 100, 120]
      const availableWidth = pageWidth - (margins[1] || 0) - (margins[3] || 0)
      return Math.max(availableWidth, 300)
    } catch {
      return 600
    }
  }

  // 通用表格构建函数（支持从 htmlCode/htmlTemplate、trList 或字段列表构建默认 100% 宽度的 TableElement）
  const buildTableElement = (comp: any): any => {
    const tableName = comp.fieldName || comp.name || '结构化表格'
    const datasetId = (
      comp.fieldKey ||
      comp.conceptId ||
      comp.name ||
      ''
    ).trim()
    const subFields: any[] =
      comp.children || comp.fieldList || comp.fields || []

    let tableElement: any = null
    if (comp.htmlCode || comp.htmlTemplate) {
      tableElement = parseTableHtml(
        comp.htmlCode || comp.htmlTemplate,
        {
          defaultConceptId: datasetId,
          name: tableName,
          availableWidth: getAvailableEditorWidth(),
          pagingRepeat: comp.pagingRepeat !== false
        }
      )
    } else if (comp.trList) {
      const cleanTrs = sanitizeTrList(comp.trList)
      let maxCols = 1
      if (Array.isArray(cleanTrs)) {
        cleanTrs.forEach((tr: any) => {
          if (Array.isArray(tr.tdList)) {
            const cols = tr.tdList.reduce(
              (sum: number, td: any) => sum + (td.colspan || 1),
              0
            )
            if (cols > maxCols) maxCols = cols
          }
        })
      }
      const isRepeat = comp.pagingRepeat !== false
      cleanTrs.forEach((tr: any) => {
        if (tr.isHeader) {
          tr.pagingRepeat = isRepeat
        }
      })
      const availableWidth = getAvailableEditorWidth()
      const colWidth = Math.floor(availableWidth / maxCols)
      tableElement = {
        type: ElementType.TABLE,
        value: '',
        conceptId: datasetId,
        name: tableName,
        pagingRepeat: isRepeat,
        colgroup: Array.from({ length: maxCols }, () => ({ width: colWidth })),
        trList: cleanTrs
      }
    }

    if (!tableElement) {
      const validCols = subFields.length
        ? subFields
        : [
            { fieldName: '列 1', fieldKey: 'key1', fieldType: 'text' },
            { fieldName: '列 2', fieldKey: 'key2', fieldType: 'text' }
          ]

      const headerTr = {
        height: 35,
        isHeader: true,
        pagingRepeat: comp.pagingRepeat !== false,
        tdList: validCols.map(col => ({
          colspan: 1,
          rowspan: 1,
          value: [
            {
              value:
                col.fieldName ||
                col.name ||
                col.fieldKey ||
                col.conceptId ||
                '列',
              bold: true
            }
          ]
        }))
      }

      const dataTr = {
        height: 40,
        loopConfig: {
          isLoopRow: true,
          datasetId
        },
        tdList: validCols.map(col => {
          const colType = (col.fieldType || col.type || 'text').toLowerCase()
          const colKey = col.fieldKey || col.conceptId || ''
          const colName = col.fieldName || col.name || colKey || '字段'

          if (colType === 'array' || colType === 'image') {
            const subChild =
              Array.isArray(col.children) && typeof col.children[0] === 'object'
                ? col.children[0]
                : null
            const subFieldKey = (
              subChild?.fieldKey ||
              subChild?.conceptId ||
              ''
            ).trim()
            const colConceptId = subFieldKey
              ? `${colKey}[].${subFieldKey}`
              : colKey
            return {
              colspan: 1,
              rowspan: 1,
              value: [
                {
                  type: ElementType.CONTROL,
                  value: '',
                  control: {
                    type: ControlType.IMAGE,
                    conceptId: colConceptId,
                    placeholder: colName,
                    value: null,
                    width: col.width || 42,
                    height: col.height || 42
                  }
                }
              ]
            }
          }

          return {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                type: ElementType.CONTROL,
                value: '',
                control: buildFieldControl(col, [], colKey)
              }
            ]
          }
        })
      }

      const availableWidth = getAvailableEditorWidth()
      const colWidth = Math.floor(availableWidth / validCols.length)

      tableElement = {
        type: ElementType.TABLE,
        value: '',
        conceptId: datasetId,
        name: tableName,
        colgroup: Array.from({ length: validCols.length }, () => ({
          width: colWidth
        })),
        trList: [headerTr, dataTr]
      }
    }

    return tableElement
  }

  // -------------------------------------------------------------
  // 31.1 单值字段胶囊 (Chip) DOM 构建
  // -------------------------------------------------------------
  const createFieldChipDom = (
    comp: any,
    parentDatasetId?: string
  ): HTMLElement => {
    const chip = document.createElement('div')
    chip.className = 'aside-field-chip'
    chip.setAttribute('draggable', 'true')
    const fieldName =
      comp.fieldName ||
      comp.name ||
      comp.label ||
      comp.fieldKey ||
      comp.conceptId ||
      '字段'
    const fieldKey = buildFieldPath(comp)
    const fieldType = (comp.fieldType || comp.type || 'text').toLowerCase()
    chip.title = `点击或拖拽插入: ${fieldName} (${fieldKey})`

    const icon = COMPONENT_TYPE_ICON[fieldType] || 'text'
    chip.innerHTML = `
      <span class="aside-field-chip__name">
        <span class="aside-component-type-tag">${icon}</span>
        <span>${fieldName}</span>
      </span>
      <span class="aside-field-chip__action">
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M6 2v8M2 6h8" />
        </svg>
      </span>
    `

    const doInsert = () => {
      const range = instance.command.getRange()
      if (!~range.startIndex) {
        const val = (instance.command as any).getValue()
        const elementList = val?.data?.main || val?.main || []
        const lastIndex = elementList.length ? elementList.length - 1 : 0
        instance.command.executeSetRange(lastIndex, lastIndex)
      }

      instance.command.executeInsertControl({
        type: ElementType.CONTROL,
        value: '',
        control: buildFieldControl(comp)
      })

      // 若插入在表格内且所属数据集，则赋予该行循环 loopConfig
      if (parentDatasetId) {
        try {
          const curPosition = (instance.command as any).getPosition()
          const tableContext = curPosition?.positionContext?.tableContext
          if (tableContext && tableContext.tr) {
            tableContext.tr.loopConfig = {
              isLoopRow: true,
              datasetId: parentDatasetId
            }
          }
        } catch {
          // ignore context check outside table
        }
      }
    }

    chip.onclick = doInsert
    bindDragData(chip, () => {
      const isListType =
        fieldType === 'list' ||
        (fieldType === 'array' &&
          !comp.tablePattern &&
          Array.isArray(comp.children))
      return {
        conceptId: fieldKey,
        path: fieldKey,
        name: fieldName,
        type: isListType ? 'list' : fieldType,
        parentDatasetId,
        dateFormat: comp.dateFormat,
        options: comp.options,
        children: comp.children
      }
    })

    return chip
  }

  // -------------------------------------------------------------
  // 31.2 业务明细表格微缩骨架/缩略图生成器
  // -------------------------------------------------------------
  const renderMiniTableSkeleton = (comp: any): string => {
    let rowsData: {
      isHeader: boolean
      isLoop: boolean
      cells: { colspan: number; text: string; isTh: boolean }[]
    }[] = []

    if (comp.htmlCode || comp.htmlTemplate) {
      try {
        const doc = new DOMParser().parseFromString(
          comp.htmlCode || comp.htmlTemplate,
          'text/html'
        )
        const tableEl = doc.querySelector('table')
        if (tableEl) {
          const trEls = Array.from(tableEl.querySelectorAll('tr')).slice(0, 4)
          rowsData = trEls.map((tr, rIdx) => {
            const isHeader =
              rIdx === 0 ||
              tr.querySelector('th') !== null ||
              tr.closest('thead') !== null
            const isLoop = !!(
              tr.getAttribute('loop') ||
              tr.closest('tbody')?.getAttribute('loop')
            )
            const cells = Array.from(tr.querySelectorAll('th, td')).map(
              cell => ({
                colspan: parseInt(cell.getAttribute('colspan') || '1', 10),
                text:
                  (cell.textContent?.trim() || '')
                    .replace(/\{\{.*?\}\}/g, '···')
                    .slice(0, 7) || '···',
                isTh: cell.tagName.toLowerCase() === 'th' || isHeader
              })
            )
            return { isHeader, isLoop, cells }
          })
        }
      } catch {
        // ignore
      }
    } else if (comp.trList && Array.isArray(comp.trList)) {
      rowsData = comp.trList.slice(0, 4).map((tr: any) => ({
        isHeader: !!tr.isHeader,
        isLoop: !!tr.loopConfig?.isLoopRow,
        cells: (tr.tdList || []).map((td: any) => ({
          colspan: td.colspan || 1,
          text:
            (td.value || [])
              .map((v: any) => v.value || (v.control ? '···' : ''))
              .join('')
              .slice(0, 7) || '···',
          isTh: !!tr.isHeader
        }))
      }))
    }

    if (rowsData.length) {
      let html =
        '<div class="aside-table-mini-preview"><table class="mini-table-grid">'
      for (const row of rowsData) {
        html += `<tr class="${row.isHeader ? 'mini-tr-header' : row.isLoop ? 'mini-tr-loop' : ''}">`
        for (const cell of row.cells) {
          html += `<td colspan="${cell.colspan}" class="${cell.isTh ? 'mini-th' : 'mini-td'}"><span class="mini-cell-text">${cell.text}</span></td>`
        }
        html += '</tr>'
      }
      html += '</table></div>'
      return html
    }

    return `
      <div class="aside-table-mini-preview">
        <div class="mini-table-placeholder-grid">
          <div class="mini-row mini-header-row"><span class="mini-bar"></span><span class="mini-bar"></span><span class="mini-bar"></span><span class="mini-bar"></span></div>
          <div class="mini-row"><span class="mini-bar sub"></span><span class="mini-bar sub"></span><span class="mini-bar sub"></span><span class="mini-bar sub"></span></div>
          <div class="mini-row"><span class="mini-bar sub"></span><span class="mini-bar sub"></span><span class="mini-bar sub"></span><span class="mini-bar sub"></span></div>
        </div>
      </div>
    `
  }

  // -------------------------------------------------------------
  // 31.2.2 业务明细表格卡片 (Table Card) DOM 构建
  // -------------------------------------------------------------
  const createTableCardDom = (comp: any) => {
    const card = document.createElement('div')
    card.className = 'aside-table-card'
    card.setAttribute('draggable', 'true')
    const tableName = comp.fieldName || comp.name || '结构化报表表格'
    const datasetId = (
      comp.fieldKey ||
      comp.conceptId ||
      comp.name ||
      ''
    ).trim()
    const description = comp.description || ''
    const subFields: any[] =
      comp.children || comp.fieldList || comp.fields || []

    card.title = `可拖拽插入整表: ${tableName}`

    const miniPreviewHtml = renderMiniTableSkeleton(comp)

    card.innerHTML = `
      <div class="aside-table-card__header">
        <div class="aside-table-card__title" title="${tableName}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#2563eb" stroke-width="2" style="flex-shrink:0;">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          <span>${tableName}</span>
        </div>
        <span class="aside-table-card__tag">可拖拽</span>
      </div>

      <div class="aside-table-card__body">
        <!-- 表格微缩骨架/缩略图预览区 -->
        ${miniPreviewHtml}

        ${description ? `<div class="aside-table-card__desc" title="${description}">${description}</div>` : ''}

        <div class="aside-table-card__actions">
          <button class="aside-table-card__insert-btn" title="一键在光标处插入完整表格">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:3px;">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            插入整表
          </button>
        </div>
      </div>
    `

    const insertFullTable = () => {
      const range = instance.command.getRange()
      if (!~range.startIndex) {
        const val = (instance.command as any).getValue()
        const elementList = val?.data?.main || val?.main || []
        const lastIndex = elementList.length ? elementList.length - 1 : 0
        instance.command.executeSetRange(lastIndex, lastIndex)
      }

      const tableElement = buildTableElement(comp)
      if (tableElement) {
        instance.command.executeInsertElementList([tableElement])
      }
    }

    // 绑定插入按钮
    const insertBtn = card.querySelector<HTMLButtonElement>(
      '.aside-table-card__insert-btn'
    )!
    if (insertBtn) {
      insertBtn.onclick = (e: MouseEvent) => {
        e.stopPropagation()
        insertFullTable()
      }
    }

    // 卡片整体拖拽
    bindDragData(card, () => ({
      ...comp,
      type: 'table',
      conceptId: datasetId,
      path: datasetId,
      name: tableName,
      trList: comp.trList,
      htmlCode: comp.htmlCode || comp.htmlTemplate,
      subFields
    }))

    return card
  }

  // -------------------------------------------------------------
  // 31.3 右侧面板 Tab 状态与搜索事件监听
  // -------------------------------------------------------------
  let currentAsideTab: 'scalar' | 'table' = 'scalar'
  let asideSearchKeyword = ''
  let isAsideToolbarBound = false

  const bindAsideToolbarEvents = () => {
    if (isAsideToolbarBound) return
    isAsideToolbarBound = true

    const tabScalar = document.getElementById('aside-tab-scalar')
    const tabTable = document.getElementById('aside-tab-table')
    const searchInput = document.getElementById('aside-search-input') as HTMLInputElement | null
    const searchClear = document.getElementById('aside-search-clear')

    if (tabScalar && tabTable) {
      tabScalar.onclick = () => {
        if (currentAsideTab === 'scalar') return
        currentAsideTab = 'scalar'
        tabScalar.classList.add('active')
        tabTable.classList.remove('active')
        updateComponents(currentComponentsData)
      }

      tabTable.onclick = () => {
        if (currentAsideTab === 'table') return
        currentAsideTab = 'table'
        tabTable.classList.add('active')
        tabScalar.classList.remove('active')
        updateComponents(currentComponentsData)
      }
    }

    if (searchInput) {
      searchInput.oninput = () => {
        asideSearchKeyword = searchInput.value.trim().toLowerCase()
        if (searchClear) {
          if (asideSearchKeyword) {
            searchClear.classList.remove('hidden')
          } else {
            searchClear.classList.add('hidden')
          }
        }
        updateComponents(currentComponentsData)
      }
    }

    if (searchClear && searchInput) {
      searchClear.onclick = () => {
        searchInput.value = ''
        asideSearchKeyword = ''
        searchClear.classList.add('hidden')
        updateComponents(currentComponentsData)
      }
    }
  }

  // -------------------------------------------------------------
  // 31.4 组内分流渲染函数 (依据当前激活 Tab 与搜索词过滤)
  // -------------------------------------------------------------
  const isTableField = (field: any): boolean => {
    const fType = (field.fieldType || field.type || 'text').toLowerCase()
    if (fType === 'table' || fType === 'business_table' || field.trList || field.htmlTemplate) {
      return true
    }
    if (fType === 'array') {
      const children: any[] = field.children || field.fieldList || field.fields || []
      const hasTablePattern = !!field.tablePattern
      const isMultiColTable =
        children.length > 1 &&
        children.some((c: any) => {
          const ct = (c.fieldType || c.type || 'text').toLowerCase()
          return ct === 'array' || ct === 'image' || ct === 'number' || ct === 'date'
        })
      const hasDistinctKeys =
        children.length > 1 &&
        new Set(children.map((c: any) => (c.fieldKey || c.conceptId || '').split('.').pop())).size > 1

      return hasTablePattern || isMultiColTable || (children.length > 1 && hasDistinctKeys)
    }
    return false
  }

  const matchesSearch = (item: any, keyword: string): boolean => {
    if (!keyword) return true
    const name = (item.name || item.fieldName || '').toLowerCase()
    const key = (item.conceptId || item.fieldKey || '').toLowerCase()
    const desc = (item.description || '').toLowerCase()
    return name.includes(keyword) || key.includes(keyword) || desc.includes(keyword)
  }

  const renderGroupContent = (container: HTMLElement, fields: any[]) => {
    if (!Array.isArray(fields) || !fields.length) {
      container.innerHTML =
        '<div class="aside-component-empty">该分组暂无控件</div>'
      return
    }

    const scalarFields: any[] = []
    const tableFields: any[] = []

    fields.forEach(field => {
      const fType = (field.fieldType || field.type || 'text').toLowerCase()
      if (isTableField(field)) {
        tableFields.push(field)
      } else if (fType === 'object') {
        const objChildren = field.children || field.fieldList || field.fields || []
        objChildren.forEach((child: any) => scalarFields.push(child))
      } else {
        scalarFields.push(field)
      }
    })

    if (currentAsideTab === 'scalar') {
      // 普通控件 Tab
      const filtered = scalarFields.filter(f => matchesSearch(f, asideSearchKeyword))
      if (!filtered.length) {
        container.innerHTML =
          '<div class="aside-component-empty">无匹配的普通控件</div>'
        return
      }
      const grid = document.createElement('div')
      grid.className = 'aside-field-grid'
      filtered.forEach(f => {
        grid.appendChild(createFieldChipDom(f))
      })
      container.appendChild(grid)
    } else {
      // 表格控件 Tab (一行两个展示)
      const filtered = tableFields.filter(t => matchesSearch(t, asideSearchKeyword))
      if (!filtered.length) {
        container.innerHTML =
          '<div class="aside-component-empty">无匹配的表格控件</div>'
        return
      }
      const grid = document.createElement('div')
      grid.className = 'aside-table-grid'
      filtered.forEach(t => {
        grid.appendChild(createTableCardDom(t))
      })
      container.appendChild(grid)
    }
  }

  // -------------------------------------------------------------
  // 31.5 全量更新占位符/控件面板与徽章计数
  // -------------------------------------------------------------
  function updateComponents(components: any) {
    currentComponentsData = components || []
    bindAsideToolbarEvents()

    if (!asideContainer) return
    if (!components) {
      asideContainer.innerHTML =
        '<div class="aside-component-empty">暂无可用控件</div>'
      return
    }

    let groups: any[] = []
    if (!Array.isArray(components) && typeof components === 'object') {
      groups = [components]
    } else if (Array.isArray(components)) {
      groups = components
    }

    if (!groups.length) {
      asideContainer.innerHTML =
        '<div class="aside-component-empty">暂无可用控件</div>'
      return
    }

    // 统计各 Tab 数量
    let totalScalars = 0
    let totalTables = 0
    groups.forEach(g => {
      const fList = g.children || g.fieldList || []
      fList.forEach((f: any) => {
        if (isTableField(f)) {
          totalTables++
        } else {
          totalScalars++
        }
      })
    })

    const badgeScalar = document.getElementById('aside-badge-scalar')
    const badgeTable = document.getElementById('aside-badge-table')
    if (badgeScalar) badgeScalar.innerText = String(totalScalars)
    if (badgeTable) badgeTable.innerText = String(totalTables)

    asideContainer.innerHTML = ''
    const hasGroup = groups.some(
      item =>
        item &&
        (item.groupName || item.systemName) &&
        (Array.isArray(item.fieldList) || Array.isArray(item.children))
    )

    if (!hasGroup) {
      renderGroupContent(asideContainer, groups)
    } else {
      let hasAnyRenderedGroup = false

      groups.forEach((group, idx) => {
        if (!group) return
        const fields = group.fieldList || group.children || []

        // 检查该组在当前 Tab 和搜索条件是否有内容
        const hasMatchingItems = fields.some((f: any) => {
          const isTable = isTableField(f)
          const matchTab = currentAsideTab === 'table' ? isTable : !isTable
          return matchTab && matchesSearch(f, asideSearchKeyword)
        })

        // 若分组内无任何匹配控件，则不渲染该分组
        if (!hasMatchingItems) {
          return
        }

        hasAnyRenderedGroup = true
        const groupDom = document.createElement('div')
        groupDom.className = `aside-group ${group.collapsed ? 'collapsed' : ''}`

        const titleText =
          group.groupName || group.systemName || `分组 ${idx + 1}`
        const groupHeader = document.createElement('div')
        groupHeader.className = 'aside-group__header'
        groupHeader.innerHTML = `
          <span class="aside-group__title">${titleText}</span>
          <svg class="aside-group__arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `
        groupHeader.onclick = () => {
          groupDom.classList.toggle('collapsed')
        }

        const groupBody = document.createElement('div')
        groupBody.className = 'aside-group__body'
        renderGroupContent(groupBody, fields)

        groupDom.appendChild(groupHeader)
        groupDom.appendChild(groupBody)
        asideContainer.appendChild(groupDom)
      })

      if (!hasAnyRenderedGroup) {
        asideContainer.innerHTML = asideSearchKeyword
          ? '<div class="aside-component-empty">未搜索到符合条件的控件</div>'
          : `<div class="aside-component-empty">当前分类下暂无可用${currentAsideTab === 'table' ? '表格' : '普通'}控件</div>`
      }
    }
  }

  // -------------------------------------------------------------
  // 31.5 默认组件字典预设 (作为没有后端/缓存时的 Mock 数据源)
  // -------------------------------------------------------------
  const DEFAULT_COMPONENT_DATA = [
    {
      groupName: '就诊与诊断基础信息',
      systemName: 'HIS电子病历系统',
      description: '患者基本登记信息、门诊知情条款与临床诊断列表',
      children: [
        { conceptId: 'patient.name', name: '患者姓名', type: 'text', description: '就诊患者真实姓名' },
        { conceptId: 'patient.age', name: '患者年龄', type: 'text', description: '就诊时实际年龄' },
        { conceptId: 'patient.dept', name: '就诊科室', type: 'text', description: '接诊科室名称' },
        {
          conceptId: 'patient.gender',
          name: '患者性别 (List.Radio)',
          type: 'list',
          listType: 'radio',
          layout: 'horizontal',
          description: '单选选项组，宿主下发选项数组并驱动互斥勾选'
        },
        {
          conceptId: 'diagnose.diagnosis_items',
          name: '临床诊断列表 (List.Text)',
          type: 'list',
          listType: 'text',
          layout: 'vertical',
          description: '多行分段列表，宿主下发 [{label, code}] 自动格式化多行'
        },
        {
          conceptId: 'surgery.consent_clauses',
          name: '知情同意条款 (List.Checkbox)',
          type: 'list',
          listType: 'checkbox',
          layout: 'vertical',
          description: '多段复选框列表，宿主下发条款选项并驱动多项勾选'
        },
        {
          conceptId: 'exam.report_images',
          name: '检查影像多图 (List.Image)',
          type: 'list',
          listType: 'image',
          layout: 'grid',
          gridCols: 3,
          description: '影像报告多图集合，自适应网格排列渲染'
        }
      ]
    },
    {
      groupName: '医疗质控评分考核表',
      systemName: 'EMR质控系统',
      description: '医疗质量考核打分：含固定表头、明细动态循环行及表尾合并合计行',
      children: [
        {
          conceptId: 'score_sheet',
          name: '评分汇总表 (含表尾合并合计行)',
          type: 'table',
          pagingRepeat: false,
          description: '前置表头 + 动态明细循环 + 表尾合并合计行 (colspan=2)',
          htmlTemplate: `<table border="1">
  <!-- 1. 表头行 -->
  <tr>
    <th>序号</th>
    <th>评审项目</th>
    <th>满分分值</th>
    <th>实际得分</th>
  </tr>

  <!-- 2. 动态明细循环行 (loop 声明循环源) -->
  <tr loop="item in score_sheet.items">
    <td>{{ item.index }}</td>
    <td>{{ item.item_name }}</td>
    <td>{{ item.max_score }}</td>
    <td>{{ item.actual_score }}</td>
  </tr>

  <!-- 3. 表尾固定合计行 (colspan=2 合并 + 汇总字段) -->
  <tr>
    <td colspan="2" align="center"><b>合 计</b></td>
    <td>{{ score_sheet.total_max }}</td>
    <td>{{ score_sheet.total_actual }}</td>
  </tr>
</table>`
        }
      ]
    },
    {
      groupName: 'LIS常规检验明细表',
      systemName: 'LIS检验系统',
      description: '检验科血液生化结果明细，支持根据首列相邻相同数据自动纵向合并(Rowspan)',
      children: [
        {
          conceptId: 'lis.adjacent_merge_table',
          name: 'LIS常规检验明细表 (合并同类项 merge-same)',
          type: 'table',
          pagingRepeat: false,
          description: '首列使用 merge-same 指令声明相同检验大类自动纵向合并，其余列正常循环',
          htmlTemplate: `<table border="1">
  <tr>
    <th>检验大类</th>
    <th>检测项目</th>
    <th>结果数值</th>
    <th>单位</th>
    <th>参考范围</th>
  </tr>
  <tr loop="item in lis.records">
    <!-- merge-same 声明此列遇到连续相同内容时自动纵向合并单元格 -->
    <td merge-same>{{ item.category_name }}</td>
    <td>{{ item.lab_item_name }}</td>
    <td>{{ item.lab_item_value }}</td>
    <td>{{ item.lab_item_unit }}</td>
    <td>{{ item.lab_item_ref }}</td>
  </tr>
</table>`
        }
      ]
    },
    {
      groupName: '大标题复合检验影像报告',
      systemName: 'LIS复合检验系统',
      description: '多级复合结构：外层循环大标题通栏合并(Colspan=4)，内层循环表格明细，单元格内嵌套多图',
      children: [
        {
          conceptId: 'composite.grouped_report',
          name: '大标题复合检验报告集 (通栏合并+多图)',
          type: 'table',
          pagingRepeat: false,
          description: '大标题通栏合并(Colspan=4)，内层指标明细，单元格嵌套多图',
          htmlTemplate: `<table border="1">
  <!-- 1. 固定表头行 -->
  <thead>
    <tr>
      <th>检测项目</th>
      <th>结果数值</th>
      <th>参考范围</th>
      <th>化验报告影像 (多图)</th>
    </tr>
  </thead>

  <!-- 2. 外层循环大标题分组 (tbody 循环外层数组) -->
  <tbody loop="group in composite.grouped_report">
    <!-- 组内大标题通栏行 -->
    <tr>
      <td colspan="4" align="left" style="background:#F2F4F8;"><b>■ {{ group.title }}</b></td>
    </tr>

    <!-- 组内具体的明细循环行 (循环 group.children 数组) -->
    <tr loop="item in group.children">
      <td>{{ item.itemName }}</td>
      <td>{{ item.result }}</td>
      <td>{{ item.reference }}</td>
      <td>{{ item.imgList }}</td>
    </tr>
  </tbody>
</table>`
        }
      ]
    }
  ]

  const sanitizeGroupDictionary = (list: any[]) => {
    if (!Array.isArray(list)) return
    list.forEach((g: any) => {
      g.groupName = g.groupName || g.name || ''
      const fields = g.children || g.fieldList || g.fields || []
      g.children = fields
      fields.forEach((f: any) => {
        f.name = sanitizePlaceholderText(f.name || f.fieldName || '')
        f.conceptId = f.conceptId || f.fieldKey || f.fieldPath || f.key || ''
        f.type = f.type || f.fieldType || f.controlType || 'text'
        f.description = f.description || f.fieldDesc || ''
        if (f.htmlTemplate && !f.trList) {
          const parsed = parseTableHtml(f.htmlTemplate)
          if (parsed?.trList) {
            f.trList = parsed.trList
          }
          if (parsed?.colgroup) {
            f.colgroup = parsed.colgroup
          }
        }
        if (f.trList) {
          f.trList = sanitizeTrList(f.trList)
        }
      })
    })
  }

  // -------------------------------------------------------------
  // 31.6 组件字典加载体系 (优先级: main.ts接口 > iframe-design宿主 > 本地缓存/DEFAULT_DATA)
  // -------------------------------------------------------------
  async function loadComponentDictionary() {
    // 优先级 1: 优先直接请求后端接口
    try {
      console.log('[loadComponentDictionary] 正在尝试请求后端组件字典接口...')
      const res: any = await http.get('/system/component-dictionary/group/list')
      const groups =
        res?.data?.rows ||
        res?.data ||
        res?.rows ||
        (Array.isArray(res) ? res : null)
      if (Array.isArray(groups) && groups.length > 0) {
        // 并发拉取各个分组下的 field-tree
        const fullGroups = await Promise.all(
          groups.map(async (g: any) => {
            const groupId = g.id || g.groupId
            let children: any[] = g.children || g.fieldList || []
            if (groupId && (!children || children.length === 0)) {
              try {
                const treeRes: any = await http.get(
                  `/system/component-dictionary/group/${groupId}/field-tree`
                )
                const treeData =
                  treeRes?.data ||
                  treeRes?.rows ||
                  (Array.isArray(treeRes) ? treeRes : [])
                if (Array.isArray(treeData) && treeData.length > 0) {
                  children = treeData
                }
              } catch {
                // ignore single group tree error
              }
            }
            return {
              ...g,
              groupName: g.groupName || g.name,
              systemName: g.systemName,
              description: g.description,
              children
            }
          })
        )

        sanitizeGroupDictionary(fullGroups)
        updateComponents(fullGroups)
        localStorage.setItem(
          'CE_COMPONENT_DICTIONARY',
          JSON.stringify(fullGroups)
        )
        console.log('[loadComponentDictionary] 成功从后端接口加载组件字典！')
        return
      }
    } catch (err) {
      console.warn(
        '[loadComponentDictionary] 接口请求未通，转入宿主下发与本地降级流程:',
        err
      )
    }

    // 优先级 2: 宿主 iframe-design.html 下发数据
    if (
      currentComponentsData &&
      Array.isArray(currentComponentsData) &&
      currentComponentsData.length > 0
    ) {
      sanitizeGroupDictionary(currentComponentsData)
      updateComponents(currentComponentsData)
      return
    }

    // 优先级 3: 本地 localStorage 缓存或默认 DEFAULT_COMPONENT_DATA
    try {
      const cached = localStorage.getItem('CE_COMPONENT_DICTIONARY')
      let list: any[] = []
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed
          }
        } catch (e) {
          console.warn('[loadComponentDictionary] 解析 localStorage 缓存失败', e)
        }
      }

      if (!list || list.length === 0) {
        list = JSON.parse(JSON.stringify(DEFAULT_COMPONENT_DATA))
      }

      sanitizeGroupDictionary(list)
      updateComponents(list)
    } catch (err: any) {
      console.error('[获取组件字典] 本地兜底加载异常:', err)
      updateComponents([])
    }
  }

  // 监听跨页面 / component-management.html 的数据保存事件，实现实时热同步
  window.addEventListener('storage', e => {
    if (e.key === 'CE_COMPONENT_DICTIONARY') {
      console.log('[StorageEvent] 检测到占位符字典发生变更，自动重新加载面板')
      loadComponentDictionary()
    }
  })

  // 初始默认展开右侧占位符面板
  if (asidePanelDom) {
    asidePanelDom.classList.remove('hidden')
    asidePanelDom.classList.add('open')
    if (asideToggleDom) asideToggleDom.classList.add('active')
  }

  // 底部 Toolbox 占位符图标点击展开/收起面板
  if (asideToggleDom && asidePanelDom) {
    asideToggleDom.onclick = () => {
      const willOpen = asidePanelDom.classList.contains('hidden')
      asidePanelDom.classList.toggle('hidden', !willOpen)
      asidePanelDom.classList.toggle('open', willOpen)
      asideToggleDom.classList.toggle('active', willOpen)

      // 窄屏下互斥收起左侧目录
      if (willOpen && window.innerWidth <= 1440) {
        if (catalogDom && !catalogDom.classList.contains('hidden')) {
          isCatalogShow = false
          catalogDom.classList.add('hidden')
          catalogDom.classList.remove('open')
        }
      }
    }
  }

  // 关闭 x 号图标点击事件
  if (asideCloseBtnDom && asidePanelDom) {
    asideCloseBtnDom.onclick = () => {
      asidePanelDom.classList.add('hidden')
      asidePanelDom.classList.remove('open')
      if (asideToggleDom) asideToggleDom.classList.remove('active')
    }
  }



  // 查看数据结构按钮点击事件 (弹窗展示 JSON)
  if (asideViewDataBtnDom) {
    asideViewDataBtnDom.onclick = () => {
      new Dialog({
        title: '数据集数据结构 JSON',
        data: [
          {
            type: 'textarea',
            name: 'json',
            height: 240,
            value: JSON.stringify(currentComponentsData, null, 2)
          }
        ]
      })
    }
  }

  // 页面初始化时自动拉取组件字典
  loadComponentDictionary()

  // 挂载至 Canvas-Editor 官方推荐的 override.drop 扩展点
  instance.override.drop = (e: DragEvent) => {
    const dataStr =
      e.dataTransfer?.getData('application/json') ||
      e.dataTransfer?.getData('text/plain') ||
      e.dataTransfer?.getData('text')
    if (dataStr) {
      try {
        const comp = JSON.parse(dataStr)
        if (!comp || (!comp.conceptId && !comp.fieldKey)) return

        // 构造具备真实 canvas target 的合成事件，解决外层 container 穿透
        let target = e.target as HTMLElement
        let offsetX = e.offsetX
        let offsetY = e.offsetY
        if (!target?.dataset?.index) {
          const hitEl = document.elementFromPoint(
            e.clientX,
            e.clientY
          ) as HTMLElement
          if (hitEl && hitEl.dataset.index) {
            target = hitEl
            const rect = hitEl.getBoundingClientRect()
            offsetX = e.clientX - rect.left
            offsetY = e.clientY - rect.top
          }
        }

        const syntheticEvent = {
          target,
          offsetX,
          offsetY,
          clientX: e.clientX,
          clientY: e.clientY
        } as unknown as MouseEvent

        // 精准获取拖拽落点的上下文位置并设置选区
        const positionContext = instance.command.getPositionContextByEvent(
          syntheticEvent,
          { isMustDirectHit: false }
        )
        if (positionContext) {
          if (positionContext.tableInfo) {
            const { trIndex, tdIndex, element } = positionContext.tableInfo
            const tdValueIndex = positionContext.tdValueIndex ?? 0
            instance.command.executeSetRange(
              tdValueIndex,
              tdValueIndex,
              element.id,
              tdIndex,
              tdIndex,
              trIndex,
              trIndex
            )
            // 智能侦测与升级行循环属性
            if (comp.parentDatasetId) {
              const originalElementList = (
                instance.command as any
              ).getOriginalElementList()
              const tableElement = originalElementList.find(
                (el: any) => el.id === element.id
              )
              if (tableElement?.trList?.[trIndex]) {
                const tr = tableElement.trList[trIndex]
                if (
                  tr.loopConfig &&
                  tr.loopConfig.datasetId !== comp.parentDatasetId
                ) {
                  alert(
                    `该行已绑定至'${tr.loopConfig.datasetId}'，不能混入其他明细表的字段`
                  )
                  return { preventDefault: true }
                }
                if (!tr.loopConfig) {
                  const blockRows =
                    tr.tdList?.reduce(
                      (pre: number, td: any) => Math.max(pre, td.rowspan || 1),
                      1
                    ) || 1
                  const endTrIndex = Math.min(
                    trIndex + Math.max(blockRows, 1) - 1,
                    tableElement.trList.length - 1
                  )
                  tr.loopConfig = {
                    datasetId: comp.parentDatasetId,
                    isLoopRow: true,
                    endTrIndex
                  }
                }
              }
            }
          } else if (
            typeof positionContext.index === 'number' &&
            positionContext.index >= 0
          ) {
            instance.command.executeSetRange(
              positionContext.index,
              positionContext.index
            )
          }
        } else {
          // 兜底定位选区
          const range = instance.command.getRange()
          if (!~range.startIndex) {
            const val = (instance.command as any).getValue()
            const elementList = val?.data?.main || val?.main || []
            const lastIndex = elementList.length ? elementList.length - 1 : 0
            instance.command.executeSetRange(lastIndex, lastIndex)
          }
        }


        if (comp.type === 'table') {
          const tableElement = buildTableElement(comp)
          if (tableElement) {
            instance.command.executeInsertElementList([tableElement])
          }
          return { preventDefault: true }
        }

        // 循环行内使用相对 conceptId(由行上下文解析),其余场景使用完整路径寻址
        const fieldConceptId = comp.parentDatasetId
          ? comp.conceptId
          : comp.path || comp.conceptId
        instance.command.executeInsertControl({
          type: ElementType.CONTROL,
          value: '',
          control: buildFieldControl(comp, [], fieldConceptId)
        })
        return { preventDefault: true }
      } catch (err) {
        console.error('拖拽插入组件失败:', err)
      }
    }
    return
  }

  const cleanupMenuDividers = () => {
    const menuDom = document.querySelector<HTMLDivElement>('.menu')
    if (!menuDom) return
    const groups = Array.from(menuDom.children) as HTMLElement[]
    let prevVisibleGroup = false

    groups.forEach(group => {
      if (group.classList.contains('menu-divider')) {
        group.style.display = prevVisibleGroup ? 'block' : 'none'
        if (group.style.display === 'block') prevVisibleGroup = false
      } else {
        const visibleItems = Array.from(group.children).filter(
          child => getComputedStyle(child).display !== 'none'
        )
        if (visibleItems.length === 0) {
          group.style.display = 'none'
        } else {
          group.style.display = 'flex'
          prevVisibleGroup = true
        }
      }
    })
  }

  // 动态导出文件名配置（支持字符串或闭包函数）
  let customExportFileName: string | (() => string) | undefined

  function getExportFileName(defaultPrefix = '报告'): string {
    let name: any = customExportFileName
    if (typeof name === 'function') {
      try {
        name = name()
      } catch (e) {
        console.warn('[getExportFileName] 动态计算导出文件名失败:', e)
      }
    }
    if (typeof name === 'string' && name.trim()) {
      return name.trim()
    }
    return `${defaultPrefix}_${new Date().getTime()}`
  }

  // 应用宿主侧动态配置（来自 setConfig 调用）
  function setCustomConfig(config: any) {
    if (!config || typeof config !== 'object') return
    const { mode, asidePanel, toolbar, features, exportFileName, appId } = config

    if (appId && typeof appId === 'string') {
      const isChanged = currentAppId !== appId
      currentAppId = appId
      if (isChanged) {
        loadComponentDictionary()
      }
    }

    if (exportFileName !== undefined) {
      customExportFileName = exportFileName
    }

    // A. 细粒度 Feature 开关控制 (使用顶层安全的 resolveFeatureConfig 解析)
    if (features !== undefined) {
      activeFeatureConfig = resolveFeatureConfig(features)

      // 1. 保存按钮显隐
      if (saveDom) {
        saveDom.style.display = activeFeatureConfig.save
          ? 'inline-flex'
          : 'none'
      }

      // 2. 打印按钮显隐
      const printDom =
        document.querySelector<HTMLDivElement>('.menu-item__print')
      if (printDom) {
        printDom.style.display = activeFeatureConfig.print
          ? 'inline-flex'
          : 'none'
      }

      // 3. 导出 PDF 按钮显隐
      const exportPdfDom = document.querySelector<HTMLDivElement>(
        '.menu-item__export-pdf'
      )
      if (exportPdfDom) {
        exportPdfDom.style.display = activeFeatureConfig.export
          ? 'inline-flex'
          : 'none'
      }

      // 4. 右侧占位符面板显隐
      const isAsideVisible = activeFeatureConfig.asidePanel
      if (asidePanelDom) {
        if (isAsideVisible) {
          asidePanelDom.classList.remove('hidden')
        } else {
          asidePanelDom.classList.add('hidden')
        }
      }
      if (asideToggleDom) {
        asideToggleDom.style.display = isAsideVisible ? 'inline-block' : 'none'
      }

      // 自动收尾清理连续分割线
      cleanupMenuDividers()
    }

    // B. 处理 mode 选项 —— 只有宿主明确传入 mode 时才切换，未传则保持当前模式不变
    if (mode !== undefined && mode !== null) {
      const targetMode =
        typeof mode === 'string' ? mode : (mode?.current ?? EditorMode.READONLY)
      applyMode(targetMode)
    }

    // 5. 模式切换权限控制 (由 features.modeSwitch 独立掌控)
    if (modeElement) {
      if (activeFeatureConfig.modeSwitch) {
        modeElement.classList.remove('disabled')
      } else {
        modeElement.classList.add('disabled')
      }
    }

    // C. 兼容显式 asidePanel 选项
    if (asidePanel?.visible !== undefined) {
      if (asidePanel.visible === false) {
        asidePanelDom?.classList.add('hidden')
        if (asideToggleDom) asideToggleDom.style.display = 'none'
      } else {
        asidePanelDom?.classList.remove('hidden')
        if (asideToggleDom) asideToggleDom.style.display = 'inline-block'
      }
    }

    // D. 工具栏显示
    if (toolbar) {
      const footerDom = document.querySelector<HTMLDivElement>('.footer')
      if (footerDom)
        footerDom.style.display = toolbar.visible === false ? 'none' : 'flex'
    }
  }

  // -------------------------------------------------------------
  // 13. 统一重新绑定保存、打印与重试按钮事件
  // -------------------------------------------------------------
  if (retryBtn) {
    retryBtn.onclick = () => {
      bridge.setLoading('loading', '正在重新请求数据...')
      bridge.notifyRetry()
    }
  }

  // 统一的保存触发器（绑定工具栏图标与 Ctrl+S 快捷键）
  const handleTriggerSave = async (payload: any) => {
    console.log('[Trigger Save] elementList:', payload)
    const reportData = instance.command.getValue()
    const optionsData = instance.command.getOptions()
    const savePayload = {
      appId: currentAppId,
      templateName: urlParams.get('templateName') || '测试报告',
      reportData: JSON.stringify(reportData)
    }

    const closeLoading = toast.loading('正在保存报告模板...')
    try {
      console.log('[保存报告模板] 开始请求接口 /system/report-template ...', savePayload)
      const res: any = await http.post('/system/report-template', savePayload)
      closeLoading()
      console.log('[保存报告模板] 接口响应成功:', res)
      if (res && (res.code === 200 || res.status === 200 || res.success)) {
        toast.success(res.msg || res.message || '保存报告模板成功！')
      } else {
        toast.success((res && (res.msg || res.message)) || '保存成功！')
      }
    } catch (err: any) {
      closeLoading()
      console.error('[保存报告模板] 接口请求异常:', err)
      toast.error(`保存失败：${err.message || '网络或服务异常'}`)
    }

    // 同步上报宿主环境（若在 iframe 模式中）
    const documentJson = {
      value: reportData,
      options: optionsData,
      savePayload
    }
    await bridge.notifySave(documentJson)
  }

  const saveDom = document.querySelector<HTMLDivElement>('.menu-item__save')
  if (saveDom) {
    saveDom.onclick = handleTriggerSave
  }
  instance.listener.saved = handleTriggerSave

  // 重新绑定打印点击行为
  const printMenuDom =
    document.querySelector<HTMLDivElement>('.menu-item__print')
  if (printMenuDom) {
    printMenuDom.onclick = async () => {
      const allowed = await bridge.notifyPrint()
      if (allowed !== false) {
        instance.command.executePrint()
      }
    }
  }

  // 统一绑定模板文件导入点击行为与解析逻辑 (.docx / .json)
  const importDom = document.querySelector<HTMLDivElement>('.menu-item__import')
  const importInput =
    document.querySelector<HTMLInputElement>('#import-file-input')
  if (importDom && importInput) {
    // 居中 loading 遮罩(解析大文档时反馈)
    const showImportLoading = (text: string) => {
      let overlay = document.getElementById('file-import-loading')
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'file-import-loading'
        overlay.style.cssText =
          'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;'
        overlay.innerHTML = `
          <div style="width:44px;height:44px;border:4px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:file-import-spin 0.9s linear infinite;"></div>
          <div id="file-import-loading-text" style="color:#fff;font-size:14px;margin-top:14px;font-family:system-ui,-apple-system,sans-serif;">正在解析模板...</div>
        `
        const style = document.createElement('style')
        style.textContent =
          '@keyframes file-import-spin{to{transform:rotate(360deg)}}'
        document.head.appendChild(style)
        document.body.appendChild(overlay)
      }
      const textEl = overlay.querySelector('#file-import-loading-text')
      if (textEl) textEl.textContent = text
      overlay.style.display = 'flex'
    }
    const hideImportLoading = () => {
      const overlay = document.getElementById('file-import-loading')
      if (overlay) overlay.style.display = 'none'
    }

    // 导入成功后视口强制置顶，不自动滚动到底部
    const resetScrollToTop = () => {
      instance.command.executeSetRange(0, 0)
      const scrollContainers = [
        document.querySelector('.ce-editor'),
        document.querySelector('.ce-page-container'),
        document.documentElement,
        document.body
      ]
      scrollContainers.forEach(el => {
        if (el) {
          ;(el as HTMLElement).scrollTop = 0
        }
      })
    }

    importDom.onclick = () => {
      importInput.click()
    }
    importInput.onchange = async (e: any) => {
      const file: File = e.target.files?.[0]
      if (!file) return

      const fileName = file.name.toLowerCase()
      showImportLoading(`正在解析并导入【${file.name}】...`)
      try {
        if (fileName.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer()
          await instance.command.executeImportDocx({ arrayBuffer })
          resetScrollToTop()
          toast.success(`Word 模板【${file.name}】导入成功！`)
        } else if (fileName.endsWith('.json')) {
          const text = await file.text()
          let jsonObj: any
          try {
            jsonObj = JSON.parse(text)
          } catch {
            throw new Error('文件不是合法的 JSON 格式！')
          }

          // 严格结构校验：必须同时存在 data 和 options
          if (
            !jsonObj ||
            typeof jsonObj !== 'object' ||
            !jsonObj.data ||
            typeof jsonObj.data !== 'object' ||
            !jsonObj.options ||
            typeof jsonObj.options !== 'object'
          ) {
            throw new Error(
              'JSON 模板解析失败：文件格式不正确，必须同时包含完整的 "data" 和 "options" 根节点！'
            )
          }

          if (
            !Array.isArray(jsonObj.data.main) &&
            !Array.isArray(jsonObj.data)
          ) {
            throw new Error(
              'JSON 模板解析失败：data 节点必须包含 main 正文数据列表！'
            )
          }

          // 1. 应用 options 配置
          const draw = (instance as any).draw
          if (draw && draw.options && typeof jsonObj.options === 'object') {
            Object.assign(draw.options, jsonObj.options)
            const dpr = draw.getPagePixelRatio()
            const width = draw.getWidth()
            const height = draw.getHeight()
            draw.container.style.width = `${width}px`
            draw.pageList.forEach((p: any, i: number) => {
              p.width = width * dpr
              p.height = height * dpr
              p.style.width = `${width}px`
              p.style.height = `${height}px`
              draw._initPageContext(draw.ctxList[i])
            })
          }

          // 2. 应用 data 数据
          const editorData = Array.isArray(jsonObj.data)
            ? { main: jsonObj.data }
            : jsonObj.data
          instance.command.executeSetValue(editorData)
          resetScrollToTop()
          toast.success(`JSON 模板【${file.name}】导入成功！`)
        } else {
          throw new Error('仅支持导入 .docx 或 .json 格式的模板文件！')
        }
      } catch (err: any) {
        console.error('导入模板失败:', err)
        toast.error(err.message || '导入模板失败，请检查文件格式是否正确。')
      } finally {
        hideImportLoading()
        importInput.value = ''
      }
    }
  }
}


