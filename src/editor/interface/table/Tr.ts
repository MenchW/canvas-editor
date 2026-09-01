import { ITd } from './Td'

export interface ITr {
  id?: string
  extension?: unknown
  externalId?: string
  height: number
  tdList: ITd[]
  minHeight?: number
  isHeader?: boolean
  isFooter?: boolean
  pagingRepeat?: boolean // 在各页顶端以标题行的形式重复出现
  loopConfig?: {
    datasetId: string
    isLoopRow: boolean
    isGroupHeader?: boolean
    isTbodyGroup?: boolean
    isDetailRow?: boolean
    itemAlias?: string
    sourcePath?: string
    /**
     * 循环块结束行索引(含):循环区域由起始行(loopConfig 所在行)到 endTrIndex 组成,
     * 整块按数据条数复制;块内合并单元格(rowspan)按原格式保留
     */
    endTrIndex?: number
  }
  when?: string
}
