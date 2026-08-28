import fs from 'fs'
import path from 'path'

const distPath = path.resolve('dist')
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath)
  for (const file of files) {
    const filePath = path.join(distPath, file)
    try {
      fs.rmSync(filePath, { recursive: true, force: true })
    } catch (err) {
      console.warn(`Warning: Failed to delete ${filePath}: ${err.message}`)
    }
  }
}
