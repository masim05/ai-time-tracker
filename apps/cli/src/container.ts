import * as os from 'os';
import * as path from 'path';
import {
  CopilotCliReader,
  CodexReader,
  Diagnostic,
  NormalizedInvocation,
} from '../../../modules/session-reader';
import { ReportDeps } from '../../../modules/reporter';

export interface ContainerOptions {
  /** Home directory. Defaults to the OS home directory. */
  readonly homeDir?: string;
  /** Working directory. Defaults to `process.cwd()`. */
  readonly cwd?: string;
}

/**
 * Composition root: wires the provider readers into the report dependencies.
 * This is the only place that knows about concrete infrastructure.
 */
export function createReportDeps(options: ContainerOptions = {}): ReportDeps {
  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();

  const readers = [
    new CopilotCliReader({ baseDir: path.join(homeDir, '.copilot') }),
    new CodexReader({ baseDir: path.join(homeDir, '.codex') }),
  ];

  return {
    homeDir,
    cwd,
    now: () => Date.now(),
    readSessions(): {
      invocations: readonly NormalizedInvocation[];
      diagnostics: readonly Diagnostic[];
    } {
      const invocations: NormalizedInvocation[] = [];
      const diagnostics: Diagnostic[] = [];
      for (const reader of readers) {
        const result = reader.read();
        invocations.push(...result.invocations);
        diagnostics.push(...result.diagnostics);
      }
      return { invocations, diagnostics };
    },
  };
}
