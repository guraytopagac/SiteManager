// Libraries
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Part 1: Define the ESLint configuration for the project, including global ignores and specific rules for JavaScript and React files
export default defineConfig([
  globalIgnores([
    'dist',
    'dist_electron',
    'out',
    'node_modules'
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
    },
    rules: {
    }
  },
])