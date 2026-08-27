# Security policy

## Trust model

`pi-codex-otel` runs with the local user's permissions. Install only packages and versions you trust.

The extension reads the configured OTLP endpoint and headers from the process environment, reads the global Git email when available, and exports Codex-compatible event metadata to that endpoint.

It does not intentionally export prompt text, assistant responses, source code, file paths, shell commands, tool arguments, tool output, API keys, or OTLP header values.

Collector endpoint security, authentication, storage, access control, and retention are operator responsibilities. Anyone controlling the process environment or collector can redirect or observe telemetry.

## Supported versions

Security fixes target the latest published package version.

## Report a vulnerability

Use GitHub private vulnerability reporting for this repository. Do not open a public issue for an undisclosed vulnerability.

Include the affected version, impact, reproduction steps, and a minimal proof of concept. Redact credentials, private endpoints, personal data, prompts, and source code.

## In scope

- Export of content documented as excluded
- Credential or OTLP header disclosure
- Export to an endpoint other than the configured OTLP endpoint
- Reachable vulnerabilities in shipped runtime dependencies
