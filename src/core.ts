export interface CodexUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  totalTokens?: number;
}

export function resolveLogsEndpoint(baseEndpoint: string, logsEndpoint?: string): string {
  if (logsEndpoint) return logsEndpoint;
  const normalized = baseEndpoint.replace(/\/+$/, "");
  return normalized.endsWith("/v1/logs") ? normalized : `${normalized}/v1/logs`;
}

export function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  return Object.fromEntries(
    raw
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .flatMap((pair) => {
        const separator = pair.indexOf("=");
        if (separator < 1) return [];
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        try {
          return [[decodeURIComponent(name), decodeURIComponent(value)]];
        } catch {
          return [[name, value]];
        }
      }),
  );
}

export function completionAttributes(usage: CodexUsage): Record<string, string | number> {
  const input = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  const output = usage.output ?? 0;
  return {
    // Codex serializes these Display-formatted counters as OTLP strings.
    input_token_count: String(input),
    output_token_count: String(output),
    cached_token_count: usage.cacheRead ?? 0,
    cache_write_token_count: usage.cacheWrite ?? 0,
    reasoning_output_token_count: usage.reasoning ?? 0,
    tool_token_count: String(usage.totalTokens ?? input + output),
  };
}

/**
 * Codex reads `user.email` from the `email` claim of the id_token in auth.json.
 * The token is only decoded, never verified: it is a local file we already trust.
 */
export function idTokenEmail(idToken: string | undefined): string | undefined {
  const payload = idToken?.split(".")[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const email = claims.email ?? claims.profile?.email;
    return typeof email === "string" && email ? email : undefined;
  } catch {
    return undefined;
  }
}
