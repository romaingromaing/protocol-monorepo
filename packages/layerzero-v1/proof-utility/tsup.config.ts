import { defineConfig, getDefaultConfig } from '@layerzerolabs-internal/tsup-config'

export default defineConfig({
    ...getDefaultConfig(),
    entry: ['src/index.ts'],
})
