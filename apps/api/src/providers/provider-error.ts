export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfter?: string,
  ) {
    super(message);
  }
}
