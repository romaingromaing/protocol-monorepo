import { defineConfig, getDefaultConfig } from '@layerzerolabs-internal/tsup-config'

export default defineConfig({
    ...getDefaultConfig(),
    entry: ['./index.ts', './index.browser.ts'],
})
