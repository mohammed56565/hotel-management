let token = sessionStorage.getItem("haven-token") || "";
export function setToken(value: string) {
  token = value;
  value
    ? sessionStorage.setItem("haven-token", value)
    : sessionStorage.removeItem("haven-token");
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login")) {
      setToken("");
      window.dispatchEvent(new Event("haven-session-expired"));
    }
    const message = Array.isArray(body.detail)
      ? body.detail
          .map((e: { msg: string }) => e.msg.replace("Value error, ", ""))
          .join(" ")
      : body.detail;
    throw new Error(
      message || "The request could not be completed. Please try again.",
    );
  }
  return body as T;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
