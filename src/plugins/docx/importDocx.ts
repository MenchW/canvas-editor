import { Command } from '../../editor'
import mammoth from 'mammoth'

declare module '../../editor' {
  interface Command {
    executeImportDocx(options: IImportDocxOption): void
  }
}

export interface IImportDocxOption {
  arrayBuffer: ArrayBuffer
}

export default function (command: Command) {
  return async function (options: IImportDocxOption) {
    const { arrayBuffer } = options
    const result = await mammoth.convertToHtml({
      arrayBuffer
    })
    command.executeSetHTML({
      main: result.value
    })
  }
}
