import { cookies } from "next/headers";

export type Provider = "gemini" | "openai";

const COOKIE_NAMES: Record<Provider, string> = {
  gemini: "__Host-dana-gemini-key",
  openai: "__Host-dana-openai-key",
};

export async function getStoredKey(provider: Provider) {
  const store = await cookies();
  return store.get(COOKIE_NAMES[provider])?.value?.trim() || "";
}

export function storeKey(response: Response & { cookies: { set: Function } }, provider: Provider, apiKey: string) {
  response.cookies.set(COOKIE_NAMES[provider], apiKey, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export function clearStoredKey(response: Response & { cookies: { set: Function } }, provider: Provider) {
  response.cookies.set(COOKIE_NAMES[provider], "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
