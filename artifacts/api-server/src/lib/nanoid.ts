import { randomBytes } from "crypto";

export function nanoid(size = 21): string {
  const bytes = randomBytes(size);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < size; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
