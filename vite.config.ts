import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const name = 'canvas-editor'
  const resolve = {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url))
    }
  }
  const test = {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    css: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/editor/**'],
      exclude: [
        'src/editor/interface/**',
        'src/editor/dataset/constant/**',
        'src/editor/dataset/enum/**',
        'src/editor/core/draw/particle/latex/utils/symbols.ts',
        'src/editor/core/draw/particle/latex/utils/hershey.ts'
      ]
    }
  }
  if (mode === 'sdk') {
    return {
      resolve,
      test,
      publicDir: false,
      plugins: [
        {
          name: 'sdk-banner-plugin',
          generateBundle(_options, bundle) {
            try {
              const srcFile = path.resolve(__dirname, 'src/sdk/editor-client.ts')
              const content = fs.readFileSync(srcFile, 'utf-8')
              const match = content.match(/^\s*(\/\*\*[\s\S]*?\*\/)/)
              const banner = match ? match[1].trim() : ''
              if (banner) {
                for (const fileName in bundle) {
                  const file = bundle[fileName]
                  if (file.type === 'chunk') {
                    file.code = `${banner}\n\n${file.code}`
                  }
                }
              }
            } catch (e) {
              console.warn('[vite.config.ts] 提取 SDK 顶部注释失败:', e)
            }
          }
        }
      ],
      build: {
        outDir: 'dist/sdk',
        emptyOutDir: false,
        lib: {
          name: 'EditorClient',
          fileName: 'editor-client',
          entry: path.resolve(__dirname, 'src/sdk/index.ts'),
          formats: ['es', 'umd']
        }
      }
    }
  }
  if (mode === 'lib') {
    return {
      resolve,
      test,
      plugins: [
        cssInjectedByJsPlugin({
          styleId: `${name}-style`,
          topExecutionPriority: true
        }),
        {
          ...typescript({
            tsconfig: './tsconfig.json',
            include: ['./src/editor/**']
          }),
          apply: 'build',
          declaration: true,
          declarationDir: 'types/',
          rootDir: '/'
        }
      ],
      build: {
        emptyOutDir: false,
        lib: {
          name,
          fileName: name,
          entry: path.resolve(__dirname, 'src/editor/index.ts')
        },
        sourcemap: true
      }
    }
  }
  return {
    resolve,
    test,
    base: mode == 'development' ? `/` : name,
    plugins: [
      {
        name: 'copy-iframe-design-plugin',
        closeBundle() {
          const distDir = path.resolve(__dirname, 'dist')
          const demoIframeDist = path.resolve(
            distDir,
            'demo/iframe-design.html'
          )
          const demoDistDir = path.resolve(distDir, 'demo')

          if (fs.existsSync(demoIframeDist)) {
            let content = fs.readFileSync(demoIframeDist, 'utf-8')
            content = content.replace(
              /(src|href)=["']\.\.\/assets\//g,
              '$1="./assets/'
            )
            fs.writeFileSync(
              path.join(distDir, 'iframe-design.html'),
              content,
              'utf-8'
            )
          }

          if (fs.existsSync(demoDistDir)) {
            fs.rmSync(demoDistDir, { recursive: true, force: true })
          }
        }
      }
    ],
    build: {
      emptyOutDir: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'iframe-design': path.resolve(__dirname, 'demo/iframe-design.html')
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      watch: {
        ignored: ['**/dist/**']
      },
      proxy: {
        '/system': {
          target: 'http://10.0.43.207:30300',
          changeOrigin: true
        },
        '/prod-api': {
          target: 'http://10.0.43.207:30300',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/prod-api/, '')
        }
      }
    }
  }
})
