# Pi Codex OTEL

Pi extension that exports Pi and Oh My Pi activity as Codex-compatible OpenTelemetry logs. Use it with an existing Codex OTLP pipeline, including collectors that route `codex.*` events to Cloud Logging, BigQuery, or another observability backend.

## Install

Install from npm and restart the agent:

```sh
# Pi
pi install npm:pi-codex-otel

# Oh My Pi
omp install npm:pi-codex-otel
```

To pin a version, use `npm:pi-codex-otel@0.0.4`.

## Configure OTLP logs

The extension uses the standard OTLP environment variables. It emits no data unless `OTEL_LOGS_EXPORTER` contains `otlp` and a logs endpoint is configured.

```sh
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
# Or set OTEL_EXPORTER_OTLP_LOGS_ENDPOINT directly.
```

`OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_EXPORTER_OTLP_LOGS_HEADERS` support percent-encoded values. `OTEL_RESOURCE_ATTRIBUTES` is merged into the resource, so `OTEL_RESOURCE_ATTRIBUTES=env=prod` reproduces the `env` attribute Codex derives from `otel.environment`. `OTEL_SDK_DISABLED=true` or an exporter list containing `none` disables export.

Run `/codex-otel-status` in Pi or Oh My Pi to see whether the extension has an active endpoint.

### Reusing an existing Codex config

The extension reads environment variables only; it never parses `~/.codex/config.toml`. To send to the same endpoint Codex already uses, translate the `[otel]` section once in your shell profile and wrap the agent:

```sh
eval "$(python3 - "$HOME/.codex/config.toml" <<'TOML2ENV'
import shlex, sys, tomllib
from pathlib import Path
from urllib.parse import quote

otel = tomllib.loads(Path(sys.argv[1]).read_text()).get("otel", {})
otlp = otel.get("exporter", {}).get("otlp-http", {})
endpoint, headers = otlp.get("endpoint"), otlp.get("headers", {})
if isinstance(endpoint, str) and endpoint:
    encoded = ",".join(f"{quote(k, safe='')}={quote(v, safe='')}" for k, v in headers.items())
    print(f"export OTEL_EXPORTER_OTLP_ENDPOINT={shlex.quote(endpoint)}")
    print(f"export OTEL_EXPORTER_OTLP_HEADERS={shlex.quote(encoded)}")
    if isinstance(otel.get("environment"), str):
        print(f"export OTEL_RESOURCE_ATTRIBUTES=env={shlex.quote(otel['environment'])}")
TOML2ENV
)"

omp() {
  env OTEL_LOGS_EXPORTER=otlp OTEL_METRICS_EXPORTER=none OTEL_TRACES_EXPORTER=none \
    OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf command omp "$@"
}
```

Codex writes an endpoint that already ends in `/v1/logs`; the extension keeps it as is rather than appending a second suffix. Note that a logs endpoint in `OTEL_EXPORTER_OTLP_ENDPOINT` makes Oh My Pi's own OTLP export post to `<endpoint>/v1/logs`. Set `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` instead if you want both exports to reach the collector.

## Events

| Pi or OMP event          | Codex event                                | Selected attributes                                                                      |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Session start            | `codex.conversation_starts`                | `conversation.id`, `user.email`, `model`, `provider_name`, `reasoning_effort`            |
| User input               | `codex.user_prompt`                        | `prompt_length`, image counts                                                            |
| Completed assistant turn | `codex.api_request`                        | `duration_ms`, `http.response.status_code`                                               |
| Completed assistant turn | `codex.sse_event`                          | `event.kind=response.completed`, input, output, cache, reasoning, and total token counts |
| Tool execution           | `codex.tool_decision`, `codex.tool_result` | Tool name, call ID, decision, duration, success                                          |

Every record also carries `event.name`, `event.timestamp`, `conversation.id`, `originator`, `app.version`, `terminal.type`, `model`, and `user.email`, matching the attribute keys Codex emits. `service.name` and `originator` are reported as `codex_cli_rs` so collectors keyed to Codex accept these logs unchanged; `app.version` is set to `pi-codex-otel/<version>`, which is what distinguishes these records from the Codex CLI's own.

The extension uses the closest Pi lifecycle event where Codex has no equivalent source signal. It does not invent auth mode, sandbox policy, request IDs, or SSE frame data, and it exports logs only, no metrics or traces.

## Privacy

Prompts are always sent as `[REDACTED]`; only their character length and image count are exported. Source code, file paths, tool arguments, and tool results are never exported.

`user.email` identifies the signed-in account, resolved in order: the agent's own OAuth credential in `<agentDir>/agent.db`, then the `email` claim of the id token in `$CODEX_HOME/auth.json` (the source Codex itself reads), then `git config --global user.email`. Only the address is exported; tokens are never read into a record, verified, or sent. Review collector retention and access policies before enabling team-wide export.

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/mkusaka/pi-codex-otel.git
cd pi-codex-otel
pnpm install
pnpm run check
```

Run the local source as an extension:

```sh
# Pi
pi -e ./src/index.ts

# Oh My Pi
omp -e ./src/index.ts
```

`pnpm run check` runs oxfmt, oxlint, TypeScript type checking, and the Node test suite.
