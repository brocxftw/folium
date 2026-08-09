import { clearCsrfToken, getCsrfToken, setCsrfToken } from "@/lib/csrf";
import type { DuplicateError } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get duplicate(): DuplicateError | null {
    if (this.status === 409 && this.body && typeof this.body === "object") {
      return this.body as DuplicateError;
    }
    return null;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  json?: boolean;
};

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === "string") return body || fallback;
  if (typeof body === "object" && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.message === "string") return obj.message;
    if (Array.isArray(obj.detail)) {
      return obj.detail.map((d) => (typeof d === "object" && d && "msg" in d ? String(d.msg) : String(d))).join(", ");
    }
  }
  return fallback;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, json = true, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);

  const method = (rest.method ?? "GET").toUpperCase();
  const isMutating = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (isMutating) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  let fetchBody: BodyInit | undefined;
  if (body instanceof FormData) {
    fetchBody = body;
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    fetchBody = JSON.stringify(body);
  } else if (json && isMutating) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...rest,
    method,
    headers,
    body: fetchBody,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const responseBody = await parseErrorBody(response);

  if (!response.ok) {
    throw new ApiError(
      extractMessage(responseBody, response.statusText || "Request failed"),
      response.status,
      responseBody,
    );
  }

  if (responseBody === null || responseBody === undefined || responseBody === "") {
    return undefined as T;
  }

  return responseBody as T;
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    return apiFetch<T>(buildUrl(path, params));
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, { method: "POST", body });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, { method: "PATCH", body });
  },

  delete<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, { method: "DELETE", body });
  },

  upload<T>(path: string, formData: FormData): Promise<T> {
    return apiFetch<T>(path, { method: "POST", body: formData, json: false });
  },

  downloadUrl(documentId: string): string {
    return `/api/documents/${documentId}/download`;
  },

  thumbnailUrl(documentId: string): string {
    return `/api/documents/${documentId}/thumbnail`;
  },
};

export function handleSessionResponse(session: { csrf_token: string }): void {
  setCsrfToken(session.csrf_token);
}

export function clearSession(): void {
  clearCsrfToken();
}
