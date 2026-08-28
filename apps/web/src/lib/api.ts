type ApiError = {
  error?: { code?: string; message?: string };
};

export function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function apiErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("error" in body)) return undefined;
  const error = (body as ApiError).error;
  return typeof error?.message === "string" ? error.message : undefined;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(body) ?? "Request failed");
  }
  return body as T;
}
