#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { buildReportCommand } from '../../../modules/reporter';
import { createReportDeps } from './container';

/** Builds the root CLI program. Exported for testing. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('ai-time-tracker')
    .description(
      'Local, offline CLI that reports cross-agent AI session activity time.',
    )
    .addCommand(buildReportCommand(createReportDeps()));
  return program;
}

/** Parses argv and maps Commander errors to the documented exit codes. */
export function main(argv: readonly string[]): void {
  const program = buildProgram();
  program.exitOverride();
  try {
    program.parse(argv, { from: 'user' });
  } catch (err) {
    if (err instanceof CommanderError) {
      // Help and version output are successful terminations.
      if (
        err.code === 'commander.helpDisplayed' ||
        err.code === 'commander.help' ||
        err.code === 'commander.version'
      ) {
        process.exitCode = 0;
        return;
      }
      // All other Commander errors are invalid usage.
      process.exitCode = 2;
      return;
    }
    throw err;
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}
