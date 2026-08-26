# Contributing

`pi-codex-agent` converts Pi and Oh My Pi lifecycle events into Codex-compatible OpenTelemetry logs.

## Development

```sh
pnpm install
pnpm run check
pi -e ./src/index.ts
```

Before opening a pull request:

1. Keep the Codex event mapping and privacy contract explicit.
2. Add a behavior test for every changed mapping or parser branch.
3. Update the README when configuration, emitted attributes, or privacy behavior changes.
4. Run `pnpm pack --dry-run` and inspect the published file list.
5. Confirm tracked files contain no credentials, personal data, private endpoints, or machine-specific paths.

Do not commit environment files, collector payloads, local agent state, generated archives, prompts, source code samples, tool arguments, or tool output captured during development.
