export interface CodexUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoningTokens?: number;
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

export function completionAttributes(usage: CodexUsage): Record<string, number> {
  const input = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  const output = usage.output ?? 0;
  return {
    input_token_count: input,
    output_token_count: output,
    cached_token_count: usage.cacheRead ?? 0,
    cache_write_token_count: usage.cacheWrite ?? 0,
    reasoning_token_count: usage.reasoningTokens ?? 0,
    tool_token_count: usage.totalTokens ?? input + output,
  };
}
