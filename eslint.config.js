import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactPlugin from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // JSX: marca como "usado" cualquier variable referenciada en JSX (<Icon />, <motion.div>)
      'react/jsx-uses-vars': 'error',

      // Variables: permitir _prefix para parámetros ignorados intencionalmente
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Estas reglas de react-hooks v7 tienen falsos positivos para patrones
      // intencionalmente válidos: setState en setInterval/useEffect de sincronización,
      // Date.now() en render, patrón "previous-value ref" durante render.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity':              'off',
      'react-hooks/refs':                'off',
    },
  },
])
