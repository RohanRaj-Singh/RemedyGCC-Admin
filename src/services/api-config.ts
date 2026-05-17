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

  const serverOnlyBaseUrl =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();

  if (serverOnlyBaseUrl && typeof window === "undefined") {
    return normalizeBaseUrl(serverOnlyBaseUrl);
  }

  return "";
}
