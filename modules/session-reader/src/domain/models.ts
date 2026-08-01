/**
 * Provider-neutral session activity model.
 *
 * This is the contract between the `session-reader` module (which parses
 * provider-specific storage) and the `reporter` module (which calculates and
 * formats reports). It is pure data: no file system, SQLite, or CLI imports.
 */

/** High-level provider family. */
export type ProviderId = 'copilot' | 'codex';

/** Concrete provider interface (agent value used in the report). */
export type InterfaceId = 'copilot-cli' | 'codex-cli' | 'codex-app';

/** A half-open-agnostic work interval in epoch milliseconds. */
export interface WorkInterval {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * A single normalized agent invocation (a root session/thread or a sub-agent).
 * Every invocation belongs to exactly one launch (identified by `launchRootId`).
 */
export interface NormalizedInvocation {
  readonly provider: ProviderId;
  readonly interfaceId: InterfaceId;
  /** Id of the root invocation of this launch. Root invocations point to self. */
  readonly launchRootId: string;
  /** Unique id for this invocation (session id / thread id). */
  readonly invocationId: string;
  /** Parent invocation id for sub-agents; undefined for the root. */
  readonly parentId?: string;
  /** Working directory. `undefined` means unknown. */
  readonly cwd?: string;
  /** True when this invocation is the launch root. */
  readonly isRoot: boolean;
  /** Human prompt submission timestamps (ms). Only populated for user-driven work. */
  readonly promptsMs: readonly number[];
  /** Agent work intervals (ms). Additive across parent and children. */
  readonly agentSpans: readonly WorkInterval[];
  /** Actual start of the invocation (ms). */
  readonly startMs: number;
  /** Actual end of the invocation (ms), or `null` when still active. */
  readonly endMs: number | null;
}

/** Severity of a reader diagnostic. */
export type DiagnosticSeverity = 'warning' | 'error';

/**
 * A structured, content-free diagnostic. It MUST NEVER carry prompts, responses,
 * source code, or tool output — only metadata safe to print with `--verbose`.
 */
export interface Diagnostic {
  readonly provider: ProviderId | 'discovery';
  readonly interfaceId?: InterfaceId;
  /** Session/invocation id, when known. */
  readonly sessionId?: string;
  /** File path involved, when relevant. */
  readonly filePath?: string;
  /** Event/record type involved, when relevant. */
  readonly eventType?: string;
  /** Timestamp involved (ms), when relevant. */
  readonly timestampMs?: number;
  /** Content-free reason string. */
  readonly reason: string;
  readonly severity: DiagnosticSeverity;
}

/** Result of reading a provider's sessions. */
export interface ReadResult {
  readonly invocations: readonly NormalizedInvocation[];
  readonly diagnostics: readonly Diagnostic[];
}
