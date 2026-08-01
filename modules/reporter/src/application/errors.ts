/** Error representing invalid CLI usage. The CLI maps this to exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
