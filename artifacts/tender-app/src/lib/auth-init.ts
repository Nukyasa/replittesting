import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => {
  try {
    const raw = localStorage.getItem("asa_auth_storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
});
