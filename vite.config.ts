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
      build: {
        outDir: 'dist/sdk',
        emptyOutDir: false,
        lib: {
          name: 'EditorClient',
          fileName: 'editor-client',
          entry: path.resolve(__dirname, 'src/sdk/index.ts'),
          formats: ['es', 'umd']
        },
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
    base: `/`,
    plugins: [
      {
        name: 'flatten-demo-html-plugin',
        closeBundle() {
          const distDir = path.resolve(__dirname, 'dist')
          const demoDistDir = path.resolve(distDir, 'demo')

          // 1. 将 dist/demo/*.html 平铺移动到 dist/*.html 并修复平铺后的资源相对路径
          if (fs.existsSync(demoDistDir)) {
            const htmlFiles = fs.readdirSync(demoDistDir)
            htmlFiles.forEach(file => {
              if (file.endsWith('.html')) {
                const srcPath = path.join(demoDistDir, file)
                let content = fs.readFileSync(srcPath, 'utf-8')
                content = content.replace(/(src|href)=["']\.\.\/assets\//g, '$1="./assets/')
                fs.writeFileSync(path.join(distDir, file), content, 'utf-8')
              }
            })
            fs.rmSync(demoDistDir, { recursive: true, force: true })
          }

          // 2. 完整复制整个 common 目录（api.js, utils.js, mock.js, deps.js, lib等）到 dist/common
          const srcCommon = path.resolve(__dirname, 'demo/common')
          const destCommon = path.resolve(distDir, 'common')
          if (fs.existsSync(srcCommon)) {
            fs.cpSync(srcCommon, destCommon, { recursive: true, force: true })
          }
        }
      }
    ],
    build: {
      emptyOutDir: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'component-management': path.resolve(__dirname, 'demo/component-management.html'),
          'template-management': path.resolve(__dirname, 'demo/template-management.html'),
          'iframe-design': path.resolve(__dirname, 'demo/iframe-design.html')
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
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
