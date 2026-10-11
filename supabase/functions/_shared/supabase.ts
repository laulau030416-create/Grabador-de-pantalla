import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.117.2";

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required server setting: ${name}`);
  return value;
}

function serviceKey(): string {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const key = parsed.default;
      if (typeof key === "string" && key.length > 0) return key;
    } catch {
      // Se informa el error de configuración genérico más abajo.
    }
  }

  throw new Error("Missing Supabase server secret key");
}

export function createAdminClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), serviceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authenticatedUser(
  request: Request,
  admin: SupabaseClient
): Promise<User | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) return null;

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error) return null;
  return data.user;
}
