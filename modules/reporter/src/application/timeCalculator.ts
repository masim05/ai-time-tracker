import {
  WorkInterval,
  sumDurationsMs,
  mergeIntervals,
  subtractIntervals,
  clipInterval,
  intervalDurationMs,
} from '../../../session-reader';

/** Inclusive report period in epoch milliseconds. */
export interface Period {
  readonly fromMs: number;
  readonly toMs: number;
}

/** Threshold for the initial idle interval (launch -> first prompt). */
export const INITIAL_THRESHOLD_MS = 30 * 60 * 1000;
/** Threshold for subsequent idle intervals (completion -> next prompt). */
export const SUBSEQUENT_THRESHOLD_MS = 20 * 60 * 1000;

export interface HumanActivityInput {
  readonly launchStartMs: number;
  readonly promptsMs: readonly number[];
  /** All agent work intervals across the launch (root + sub-agents). */
  readonly agentIntervals: readonly WorkInterval[];
  readonly period: Period;
}

export interface HumanActivityResult {
  readonly humanMs: number;
  readonly inactiveMs: number;
}

/**
 * Pure time calculations for the report. All inputs are epoch milliseconds and
 * results preserve millisecond precision (rounding happens only at display).
 */
export const TimeCalculator = {
  /**
   * Agent working time for a set of spans, clipped to the period. Additive:
   * overlapping spans (e.g. parent and concurrent sub-agent) are counted
   * multiple times.
   */
  agentTimeMs(spans: readonly WorkInterval[], period: Period): number {
    return sumDurationsMs(spans, period.fromMs, period.toMs);
  },

  /**
   * Wall-clock elapsed time from launch start to final completion, clipped to
   * the period. For active launches pass `finalEndMs = period.toMs` (now).
   */
  elapsedMs(launchStartMs: number, finalEndMs: number, period: Period): number {
    const clipped = clipInterval(
      { startMs: launchStartMs, endMs: finalEndMs },
      period.fromMs,
      period.toMs,
    );
    return clipped ? intervalDurationMs(clipped) : 0;
  },

  /**
   * Human-active and inactive time for a launch.
   *
   * The idle interval before each human prompt is classified by its total
   * length: the initial interval (launch -> first prompt) is human-active when
   * <= 30 min; each subsequent interval (last completion -> next prompt) is
   * human-active when <= 20 min (both inclusive). Idle time overlapping any
   * agent activity is never counted, and the counted amount is clipped to the
   * report period.
   */
  humanActivity(input: HumanActivityInput): HumanActivityResult {
    const { launchStartMs, period } = input;
    const prompts = [...new Set(input.promptsMs)].sort((a, b) => a - b);
    const merged = mergeIntervals(input.agentIntervals);

    const completionBefore = (t: number): number | null => {
      let best: number | null = null;
      for (const iv of merged) {
        if (iv.endMs <= t) {
          best = best === null ? iv.endMs : Math.max(best, iv.endMs);
        }
      }
      return best;
    };

    let humanMs = 0;
    let inactiveMs = 0;

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      let intervalStart: number;
      let threshold: number;
      if (i === 0) {
        intervalStart = launchStartMs;
        threshold = INITIAL_THRESHOLD_MS;
      } else {
        const completion = completionBefore(prompt);
        intervalStart = completion ?? prompts[i - 1];
        threshold = SUBSEQUENT_THRESHOLD_MS;
      }

      const gap = prompt - intervalStart;
      if (gap <= 0) {
        continue;
      }

      // Count only the idle portion (no agent active), clipped to the period.
      const idleParts = subtractIntervals(
        { startMs: intervalStart, endMs: prompt },
        merged,
      );
      const idleMs = sumDurationsMs(idleParts, period.fromMs, period.toMs);

      if (gap <= threshold) {
        humanMs += idleMs;
      } else {
        inactiveMs += idleMs;
      }
    }

    return { humanMs, inactiveMs };
  },
};
