const LOCAL_API_BASE_URL = "http://127.0.0.1:5001";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const configuredValue =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredValue) {
    return normalizeBaseUrl(configuredValue);
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_API_BASE_URL;
  }

  throw new Error(
    "Missing NEXT_PUBLIC_API_BASE_URL. Set it before building or starting the admin app."
  );
}
