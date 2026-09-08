/**
 * Server-Sent Events stream for the Super Admin.
 *
 * PA8 — instant push-based delivery for Chat and Notifications.
 *
 * The admin app and tenantapp run as separate PM2 processes. The
 * tenantapp owns the realtime hub (it is the source of notification
 * and chat events). This route proxies the SSE connection to the
 * tenantapp's `/api/realtime/stream` endpoint so the admin browser
 * receives events from the tenantapp's hub.
 *
 * The proxy is transparent: the admin browser opens
 * `EventSource('/api/realtime/stream', { withCredentials: true })`.
 * The admin app validates the Super Admin session, then opens a
 * long-lived fetch to the tenantapp's SSE endpoint with the shared
 * API key. The tenantapp resolves the topic set from the API key
 * (which identifies the Super Admin) and streams events back.
 *
 * The admin browser receives the SSE events directly from the
 * tenantapp via this proxy. No new infrastructure is introduced.
 */

import { NextRequest } from "next/server";
import { requireApiAuth } from "@/app/api/_utils/auth-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  // Validate the Super Admin session. The admin app's auth guard
  // checks the session cookie. If the session is invalid, we return
  // an SSE stream with an auth-error event (same pattern as the
  // tenantapp SSE route).
  const auth = await requireApiAuth(request);
  if (!auth.success) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: auth-error\ndata: ${JSON.stringify({ reason: "unauthenticated" })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Proxy to the tenantapp's SSE endpoint. The tenantapp will
  // resolve the topic set from the API key (superadmin topic).
  const tenantAppUrl = process.env.TENANT_APP_URL ?? "http://localhost:3004";
  const apiKey = process.env.ADMIN_API_KEY ?? "";

  const upstreamUrl = new URL(`${tenantAppUrl}/api/realtime/stream`);
  // Forward the Last-Event-ID header so the tenantapp can resume
  // from the last event the admin browser received.
  const lastEventId = request.headers.get("last-event-id");
  const headers: Record<string, string> = {
    "x-admin-api-key": apiKey,
    Accept: "text/event-stream",
  };
  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers,
      signal: request.signal,
    });
  } catch {
    // Upstream is unreachable. Return a stream with a retry hint.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ reason: "upstream_unreachable" })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  if (!upstreamResponse.ok) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ reason: "upstream_error", status: upstreamResponse.status })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Stream the tenantapp's SSE response directly to the admin browser.
  // The upstream response body is a ReadableStream of SSE events.
  // We pipe it through without buffering so events arrive immediately.
  return new Response(upstreamResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
