import { Draw } from '../draw/Draw'

export class HistoryManager {
  private draw: Draw
  private undoStack: Array<Function> = []
  private redoStack: Array<Function> = []
  private maxRecordCount: number

  constructor(draw: Draw) {
    this.draw = draw
    // 忽略第一次历史记录
    this.maxRecordCount = draw.getOptions().historyMaxRecordCount + 1
  }

  public undo() {
    this.draw.flushHistory()
    console.log(`%c[History] undo called | stack length=${this.undoStack.length}`, 'color: #e91e63; font-weight: bold')
    if (this.undoStack.length > 1) {
      const pop = this.undoStack.pop()!
      this.redoStack.push(pop)
      if (this.undoStack.length) {
        this.undoStack[this.undoStack.length - 1]()
      }
    }
  }

  public redo() {
    this.draw.flushHistory()
    console.log(`%c[History] redo called | redoStack length=${this.redoStack.length}`, 'color: #9c27b0; font-weight: bold')
    if (this.redoStack.length) {
      const pop = this.redoStack.pop()!
      this.undoStack.push(pop)
      pop()
    }
  }

  public execute(fn: Function) {
    this.undoStack.push(fn)
    console.log(`%c[History] execute pushed | undoStack length=${this.undoStack.length}`, 'color: #4caf50; font-weight: bold')
    if (this.redoStack.length) {
      this.redoStack = []
    }
    while (this.undoStack.length > this.maxRecordCount) {
      this.undoStack.shift()
    }
  }

  public isCanUndo(): boolean {
    return this.undoStack.length > 1
  }

  public isCanRedo(): boolean {
    return !!this.redoStack.length
  }

  public isStackEmpty(): boolean {
    return !this.undoStack.length && !this.redoStack.length
  }

  public recovery() {
    this.undoStack = []
    this.redoStack = []
  }

  public popUndo() {
    return this.undoStack.pop()
  }
}
