const allowedOrigins = (): Set<string> => {
  const configured = [
    Deno.env.get("SITE_URL") ?? "",
    ...(Deno.env.get("APP_ALLOWED_ORIGINS") ?? "").split(","),
  ];
  const origins = configured
    .map((value) => {
      try {
        return new URL(value.trim()).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return new Set(origins);
};

const corsHeaders = (origin: string | null): Headers => {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  });
  if (origin && allowedOrigins().has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
};

export function handleCors(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins().has(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(request.headers.get("Origin"));
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}
