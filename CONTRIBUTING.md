## Contributing

### Naming

- published packages in the `layerzero-v[0-9]`/`layerzero-definitions` directory should be `@layerzerolabs/lz-<PROJECT>-<VERSION>`, e.g., `@layerzerolabs/lz-aptos-sdk-v2`.
- private packages should be `@layerzerolabs/<PROJECT>`, e.g., `@layerzerolabs/ops`.
- packages in the `apps` directory should be `@layerzerolabs/app-<PROJECT>-<VERSION>` if it is an app, e.g., `@layerzerolabs/app-bridge-v1`.
- packages in the `setting` directory should be `@layerzerolabs-internal/<TOOL>-config`, e.g., `@layerzerolabs-internal/eslint-config`. `@layerzerolabs/hardhat-config` is excluded from this rule.
- packages for third-party should follow the naming convention of the third-party, e.g., `@layerzerolabs/hardhat-workspace`.

### Code Style

You can run these commands to check/format/lint the code regardless of your current workspace

```shell
yarn format:check `pwd`
yarn lint:check `pwd`
yarn format:fix `pwd`
yarn lint:fix `pwd`
```

### Git

Recommended practices:

- **Commit Frequently**: It's a good practice to commit changes often so that each commit is small and focused, and it's easier to understand what changes were made.

- **Write Clear Commit Messages**: Make sure that commit message is concise and informative. It should describe what the commit does, why it was done, and what impact it has.

- **Use Branches**: Branches allow developers to work on different features or fixes simultaneously, without interfering with each other. It's recommended to use branches to develop new features or bug fixes.

- **Keep Branches Up-to-Date**: Always keep branches up-to-date with the latest changes from the master branch. You can use Git's merge or rebase commands to update your branches.

- **Use Pull Requests**: When you're ready to merge your changes into the master branch, create a pull request. This allows others to review your changes and give feedback before the changes are merged.

- **Use Gitignore**: Gitignore is a file that specifies which files and directories should be ignored by Git. It's a good practice to use Gitignore to avoid committing unnecessary files such as logs, build artifacts, or temporary files.

- **Use Tags**: Tags are used to mark significant points in the repository history, such as releases or milestones. They make it easy to refer to specific versions of the code.

- **Use Descriptive Branch Names With a Prefix**: Use descriptive and meaningful branch names to make it easier to understand what changes are being made in each branch. a prefix that indicates the type of change. For example,

  - `feature/`: for new features,
  - `bugfix/`: for bug fixes,
  - `hotfix/`: for urgent fixes
  - `release/`: for releases.

- **Keep Repository Clean**: Avoid committing large binary files or generated files such as compiled code or dependencies. They can make the repository bloated and slow down operations such as cloning or fetching.
