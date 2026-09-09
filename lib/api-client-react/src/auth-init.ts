import { setAuthTokenGetter } from "./custom-fetch";

// The auth store in tender-app saves token to "asa_auth_storage".
// We can parse it from localStorage directly for custom-fetch,
// or we can just provide a getter that reads from it.
setAuthTokenGetter(() => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("asa_auth_storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? parsed?.token ?? null;
  } catch (e) {
    return null;
  }
});
