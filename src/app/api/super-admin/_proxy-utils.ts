import { NextResponse } from 'next/server';

/**
 * Proxy a request to the Tenant App's API.
 */
export async function proxyToTenantApp(
  path: string,
  method: string,
  options?: { body?: unknown; timeout?: number },
): Promise<Response> {
  const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
  const apiKey = process.env.ADMIN_API_KEY ?? '';

  const headers: Record<string, string> = {
    'x-admin-api-key': apiKey,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit & { signal?: AbortSignal } = {
    method,
    headers,
    signal: AbortSignal.timeout(options?.timeout ?? 15_000),
  };

  if (options?.body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${tenantAppUrl}${path}`, fetchOptions);
  return response;
}

/**
 * Handle a proxy response, converting it to a NextResponse.
 */
export async function handleProxyResponse(response: Response): Promise<NextResponse> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    return NextResponse.json(
      { error: errorBody?.error ?? errorBody?.message ?? `Tenant App returned ${response.status}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  return NextResponse.json(data, { status: 200 });
}
