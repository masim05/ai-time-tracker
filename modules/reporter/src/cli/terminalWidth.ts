const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});

/** Splits text without separating combining sequences or joined emoji. */
export function graphemes(value: string): string[] {
  return Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment);
}

/** Returns the number of terminal display cells occupied by plain text. */
export function terminalWidth(value: string): number {
  return graphemes(value).reduce(
    (width, grapheme) => width + graphemeWidth(grapheme),
    0,
  );
}

/** Pads plain text to a terminal display-cell width. */
export function padToTerminalWidth(
  value: string,
  width: number,
  alignRight: boolean,
): string {
  const padding = ' '.repeat(Math.max(0, width - terminalWidth(value)));
  return alignRight ? padding + value : value + padding;
}

/** Truncates at a grapheme boundary and keeps the result within maxCells. */
export function truncateToTerminalWidth(
  value: string,
  maxCells: number,
  ellipsis = '…',
): string {
  if (terminalWidth(value) <= maxCells) {
    return value;
  }

  const available = Math.max(0, maxCells - terminalWidth(ellipsis));
  let result = '';
  let width = 0;
  for (const grapheme of graphemes(value)) {
    const nextWidth = graphemeWidth(grapheme);
    if (width + nextWidth > available) {
      break;
    }
    result += grapheme;
    width += nextWidth;
  }
  return result + ellipsis;
}

function graphemeWidth(grapheme: string): number {
  if (/^[\p{Mark}\p{Default_Ignorable_Code_Point}\p{Control}]+$/u.test(grapheme)) {
    return 0;
  }
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(grapheme)) {
    return 2;
  }

  for (const character of grapheme) {
    const codePoint = character.codePointAt(0)!;
    if (isWideCodePoint(codePoint)) {
      return 2;
    }
  }
  return 1;
}

// Unicode East Asian Wide/Fullwidth ranges used by common terminal wcwidth
// implementations. Grapheme handling above keeps modifiers and ZWJ sequences whole.
function isWideCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}
