import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import * as path from 'path'
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
          name: 'CanvasEditorHost',
          fileName: 'report-design-sdk',
          entry: path.resolve(__dirname, 'src/sdk/index.ts'),
          formats: ['es', 'umd']
        },
        sourcemap: true
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
    base: `/${name}/`,
    build: {
      emptyOutDir: false
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
