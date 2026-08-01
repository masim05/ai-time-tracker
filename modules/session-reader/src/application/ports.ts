import { ReadResult } from '../domain/models';

/**
 * Discovers whether a provider's local storage is present. Implementations live
 * in `infrastructure/` and own all file-system access.
 */
export interface ISessionDiscovery {
  /** Human-readable provider name, for diagnostics. */
  readonly providerName: string;
  /** Returns true when this provider's storage exists on the machine. */
  isAvailable(): boolean;
}

/**
 * Reads a provider's sessions into the normalized model. Implementations live in
 * `infrastructure/` and own all file-system / SQLite access. Reads are read-only.
 */
export interface ISessionReader {
  /**
   * Read all discoverable sessions for this provider. Never throws for
   * per-record problems: malformed records are skipped and reported as
   * diagnostics so the caller can produce a partial result.
   */
  read(): ReadResult;
}
