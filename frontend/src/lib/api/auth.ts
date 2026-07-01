import { apiFetch, clearToken, getToken, setToken } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

/** Create an account; on success the JWT is stored and attached to later requests. */
export async function signup(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthUser> {
  const res = await apiFetch<TokenResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setToken(res.accessToken);
  return res.user;
}

/** Authenticate; on success the JWT is stored and attached to later requests. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(res.accessToken);
  return res.user;
}

/** Current user from the stored token, or null if unauthenticated/expired. */
export async function fetchMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  try {
    return await apiFetch<AuthUser>("/auth/me");
  } catch {
    clearToken();
    return null;
  }
}

export function logout(): void {
  clearToken();
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}
