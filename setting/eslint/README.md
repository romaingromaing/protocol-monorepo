## Requirements

[Load Extended Plugin From File Path](https://github.com/zouguangxian/eslintrc/tree/gx/v1.4.1-file-plugin)

WARNING: `normalizePackageName` in `@eslint/eslintrc` requires that the format of the package name should be `@layerzerolabs-internal/eslint-config` or `eslint-config-layerzerolabs`.

## Configuration

- use [sort-imports](https://eslint.org/docs/latest/rules/sort-imports) and [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import) to organize imports.
- apply prettier with `eslint-plugin-prettier` and `eslint-config-prettier`.
- mark `^@layerzerolabs/` as internal with `import/internal-regex`.
- use `pathGroups` to put `^@layerzerolabs/**` ahead of the internal group.
- treat `['node_modules', '.yarn']` as external with `import/external-module-folders`.
- list typescript projects under `import/resolver`.

## Debug

set environment `DEBUG=*`
