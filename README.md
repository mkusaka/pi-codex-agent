# Pi Codex OTEL

Pi extension that exports Pi and Oh My Pi activity as Codex-compatible OpenTelemetry logs. Use it with an existing Codex OTLP pipeline, including collectors that route `codex.*` events to Cloud Logging, BigQuery, or another observability backend.

## Install

From npm:

```sh
# Pi
pi install npm:pi-codex-otel

# Oh My Pi
omp install npm:pi-codex-otel
```

Or clone the repository and install it by absolute path:

```sh
git clone https://github.com/mkusaka/pi-codex-otel.git

# Pi
pi install "$PWD/pi-codex-otel"

# Oh My Pi
omp install "$PWD/pi-codex-otel"
```

Restart the agent after installation.

## Configure OTLP logs

The extension uses the standard OTLP environment variables. It emits no data unless `OTEL_LOGS_EXPORTER` contains `otlp` and a logs endpoint is configured.

```sh
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
# Or set OTEL_EXPORTER_OTLP_LOGS_ENDPOINT directly.
```

`OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_EXPORTER_OTLP_LOGS_HEADERS` support percent-encoded values. `OTEL_SDK_DISABLED=true` or an exporter list containing `none` disables export.

Run `/codex-otel-status` in Pi or Oh My Pi to see whether the extension has an active endpoint.

## Events

| Pi or OMP event          | Codex event                                | Selected attributes                                                                      |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Session start            | `codex.conversation_starts`                | `conversation.id`, `user.email`, `model`, `provider_name`, `reasoning_effort`            |
| User input               | `codex.user_prompt`                        | `prompt_length`, image counts                                                            |
| Completed assistant turn | `codex.api_request`                        | `duration_ms`, `http.response.status_code`                                               |
| Completed assistant turn | `codex.sse_event`                          | `event.kind=response.completed`, input, output, cache, reasoning, and total token counts |
| Tool execution           | `codex.tool_decision`, `codex.tool_result` | Tool name, call ID, decision, duration, success                                          |

The extension uses the closest Pi lifecycle event where Codex has no equivalent source signal. It does not invent auth mode, sandbox policy, request IDs, or SSE frame data.

## Privacy

Prompts are always sent as `[REDACTED]`; only their character length and image count are exported. Source code, file paths, tool arguments, and tool results are never exported.

`user.email` comes from `git config --global user.email` when configured. Review collector retention and access policies before enabling team-wide export.

## Development

```sh
pnpm install
pnpm run check
omp -e ./src/index.ts
```

`pnpm run check` runs oxfmt, oxlint, TypeScript type checking, and the Node test suite.
