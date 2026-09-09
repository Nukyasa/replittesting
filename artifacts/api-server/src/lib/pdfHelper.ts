import axios from "axios";
import { assertEjnUrl, assertDocumentPayload, extractDocumentText, MAX_DOCUMENT_BYTES } from "./documentFiles";

/** Public EJN notice PDFs do not require a supplier login. */
export async function downloadAndParseEJNReport(url: string): Promise<string> {
  const safeUrl = assertEjnUrl(url);
  const response = await axios.get(safeUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: MAX_DOCUMENT_BYTES,
    maxRedirects: 3,
    beforeRedirect: (options) => { assertEjnUrl(`https://${options.hostname}${options.path}`); },
  });
  const buffer = Buffer.from(response.data);
  assertDocumentPayload(buffer, "notice.pdf", String(response.headers["content-type"] || ""));
  return extractDocumentText(buffer, "notice.pdf");
}
