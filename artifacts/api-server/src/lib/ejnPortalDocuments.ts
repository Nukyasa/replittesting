import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export const EJN_PORTAL = "https://www.ejn.gov.ba";

export interface PortalAnnouncement {
  id: number;
  procedureId?: number | null;
  number: string;
  name?: string;
  announcementType?: string;
  downloadUrl?: string;
  date?: string;
}

export async function createPublicEjnClient(): Promise<AxiosInstance> {
  const client = wrapper(axios.create({
    jar: new CookieJar(), timeout: 30000,
    headers: { Accept: "application/json", "User-Agent": "Tender-Manager/1.0" },
  }));
  // The public search uses an anonymous anti-forgery token, not a supplier login.
  const home = await client.get(`${EJN_PORTAL}/Home/Index`);
  const token = typeof home.data === "string" ? home.data.match(/var\s+csrfToken\s*=\s*['"]([^'"]+)['"]/)?.[1] : null;
  if (!token) throw new Error("EJN javna sesija nije dostupna; pokušajte ponovo kasnije.");
  client.defaults.headers.common["x-jsonrequestverificationtoken"] = token;
  client.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
  return client;
}

export function exactPortalAnnouncement(records: unknown, number: string): PortalAnnouncement | null {
  if (!Array.isArray(records)) return null;
  return records.find((row) => typeof row?.number === "string" && row.number.trim() === number.trim() && Number.isSafeInteger(row.id) && row.id > 0) || null;
}

export async function resolvePortalAnnouncement(client: AxiosInstance, number: string): Promise<PortalAnnouncement | null> {
  const response = await client.post(`${EJN_PORTAL}/api/Announcement/Search`, {
    number, page: 1, rows: 20, sidx: "id", sord: "DESC",
  });
  // OData IDs and portal IDs are different namespaces. Exact notice number is required.
  return exactPortalAnnouncement(response.data?.records, number);
}
