export class RouteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function internalRequest(path: string, init?: RequestInit) {
  return new Request(`http://internal${path}`, init);
}

export async function fromRoute<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* response body is not JSON */
    }
    throw new RouteError(res.status, message);
  }
  return (await res.json()) as T;
}
