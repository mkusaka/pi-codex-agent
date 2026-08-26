import { execFileSync } from "node:child_process";
import { hostname, release } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type LogAttributes, type Logger, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import {
  type CodexUsage,
  completionAttributes,
  parseHeaders,
  resolveLogsEndpoint,
} from "./core.js";

const EXTENSION_VERSION = "0.1.0";

type Runtime = {
  provider: LoggerProvider;
  logger: Logger;
  endpoint: string;
};

type Session = {
  id: string;
  model: string;
  provider: string;
  email?: string;
  terminalType: string;
};

function gitEmail(): string | undefined {
  try {
    return (
      execFileSync("git", ["config", "--global", "--get", "user.email"], {
        encoding: "utf8",
        timeout: 2_000,
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

function createRuntime(): Runtime | undefined {
  if (process.env.OTEL_SDK_DISABLED?.trim().toLowerCase() === "true") return undefined;
  if (process.env.OTEL_LOGS_EXPORTER?.split(",").some((value) => value.trim() === "none"))
    return undefined;
  if (!process.env.OTEL_LOGS_EXPORTER?.split(",").some((value) => value.trim() === "otlp"))
    return undefined;

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? resolveLogsEndpoint(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
      : undefined);
  if (!endpoint) return undefined;

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "codex-cli",
      "service.version": EXTENSION_VERSION,
      "os.type": process.platform,
      "os.version": release(),
      "host.arch": process.arch,
      "host.name": hostname(),
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: endpoint,
          headers: {
            ...parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
            ...parseHeaders(process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS),
          },
        }),
      }),
    ],
  });
  return { provider, logger: provider.getLogger("codex-cli", EXTENSION_VERSION), endpoint };
}

export default function codexOpenTelemetry(pi: ExtensionAPI): void {
  let runtime: Runtime | undefined;
  let session: Session | undefined;
  let agentStartedAt: number | undefined;
  const toolStartedAt = new Map<string, number>();

  const emit = (eventName: string, attributes: LogAttributes): void => {
    if (!runtime || !session) return;
    const timestamp = new Date();
    runtime.logger.emit({
      eventName,
      timestamp,
      observedTimestamp: timestamp,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: eventName,
      attributes: {
        "event.timestamp": timestamp.toISOString(),
        "conversation.id": session.id,
        originator: "pi",
        "terminal.type": session.terminalType,
        model: session.model,
        ...(session.email ? { "user.email": session.email } : {}),
        ...attributes,
      },
    });
  };

  const flush = async (): Promise<void> => {
    if (!runtime) return;
    try {
      await runtime.provider.forceFlush();
    } catch {
      // Telemetry must not alter the agent run when the collector is unavailable.
    }
  };

  pi.registerCommand("codex-otel-status", {
    description: "Show Codex-compatible OpenTelemetry log export status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        runtime
          ? `Codex-compatible logs active\nEndpoint: ${runtime.endpoint}`
          : "Codex-compatible logs disabled or missing OTEL configuration",
        "info",
      );
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    runtime = createRuntime();
    if (!runtime) return;
    const model = ctx.model;
    session = {
      id: ctx.sessionManager.getSessionId(),
      model: model?.id ?? "unknown",
      provider: model?.provider ?? "unknown",
      email: gitEmail(),
      terminalType: process.env.TERM_PROGRAM ?? process.env.TERM ?? "unknown",
    };
    emit("codex.conversation_starts", {
      provider_name: session.provider,
      reasoning_effort: pi.getThinkingLevel(),
    });
    await flush();
  });
  pi.on("model_select", async (event) => {
    if (session) {
      session.model = event.model.id;
      session.provider = event.model.provider;
    }
  });

  pi.on("input", async (event) => {
    emit("codex.user_prompt", {
      prompt_length: event.text.length,
      prompt: "[REDACTED]",
      text_input_count: 1,
      image_input_count: event.images?.length ?? 0,
      local_image_input_count: 0,
    });
    await flush();
  });

  pi.on("agent_start", async () => {
    agentStartedAt = Date.now();
  });

  pi.on("turn_end", async (event) => {
    if (event.message.role !== "assistant") return;
    const message = event.message as typeof event.message & {
      usage?: CodexUsage;
      model?: string;
      errorMessage?: string;
    };
    if (message.model && session) session.model = message.model;

    let emitted = false;
    if (agentStartedAt !== undefined) {
      const failed = Boolean(message.errorMessage);
      emit("codex.api_request", {
        duration_ms: Date.now() - agentStartedAt,
        ...(failed
          ? { "error.message": message.errorMessage ?? "request failed" }
          : { "http.response.status_code": 200 }),
        attempt: 1,
        endpoint: "unknown",
      });
      agentStartedAt = undefined;
      emitted = true;
    }

    if (message.usage && !message.errorMessage) {
      emit("codex.sse_event", {
        "event.kind": "response.completed",
        ...completionAttributes(message.usage),
        model_reasoning_effort: pi.getThinkingLevel(),
      });
      emitted = true;
    }
    if (emitted) await flush();
  });

  pi.on("tool_call", async (event) => {
    toolStartedAt.set(event.toolCallId, Date.now());
    emit("codex.tool_decision", {
      tool_name: event.toolName,
      tool_namespace: "builtin",
      call_id: event.toolCallId,
      decision: "approved",
      source: "config",
    });
  });

  pi.on("tool_result", async (event) => {
    const startedAt = toolStartedAt.get(event.toolCallId) ?? Date.now();
    toolStartedAt.delete(event.toolCallId);
    emit("codex.tool_result", {
      tool_name: event.toolName,
      tool_namespace: "builtin",
      call_id: event.toolCallId,
      duration_ms: Date.now() - startedAt,
      success: !event.isError,
      output_truncated: false,
      mcp_server: "",
      mcp_server_origin: "",
    });
    await flush();
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!runtime) return;
    try {
      await runtime.provider.forceFlush();
      await runtime.provider.shutdown();
    } catch (error) {
      if (ctx.hasUI)
        ctx.ui.notify(
          `OTEL log export failed: ${error instanceof Error ? error.message : String(error)}`,
          "warning",
        );
    } finally {
      runtime = undefined;
      session = undefined;
      agentStartedAt = undefined;
      toolStartedAt.clear();
    }
  });
}
