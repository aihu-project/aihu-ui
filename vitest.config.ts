import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    passWithNoTests: false,
  },
})
