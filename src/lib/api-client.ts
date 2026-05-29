export type ApiErrorPayload = {
  error?: string;
  hint?: string;
  code?: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  status: number;
  hint?: string;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.hint = payload?.hint;
    this.code = payload?.code;
    this.details = payload?.details;
  }
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const message = payload?.error || `Request feilet med status ${response.status}`;
    throw new ApiClientError(message, response.status, payload ?? undefined);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function toUserErrorMessage(error: unknown, fallback = "Noe gikk galt. Prøv igjen.") {
  if (error instanceof ApiClientError) {
    return error.hint ? `${error.message} ${error.hint}` : error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
