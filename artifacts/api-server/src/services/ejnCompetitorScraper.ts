import { db, tendersTable, tenderCompetitorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";
import { EjnSessionManager } from "./ejnSession";
import { logger } from "../lib/logger";
import { nanoid } from "../lib/nanoid";

function parsePrice(text: string): number {
  const match = text.match(/([\d\.,\s]+)(?=\s*KM)/i) || text.match(/([\d\.,\s]+)/);
  if (!match) return 0;
  
  // Remove spaces and non-breaking spaces
  let val = match[1].replace(/[\s\xa0]/g, "").trim();
  if (!val) return 0;
  
  // clean formatting
  if (val.includes(".") && val.includes(",")) {
    if (val.indexOf(".") < val.indexOf(",")) {
      // BiH style: 10.000,00
      val = val.replace(/\./g, "").replace(",", ".");
    } else {
      // US style: 10,000.00
      val = val.replace(/,/g, "");
    }
  } else if (val.includes(",")) {
    // Only comma: check if it's BiH style decimal
    const parts = val.split(",");
    if (parts[1] && parts[1].length === 2) {
      val = val.replace(",", ".");
    } else {
      val = val.replace(",", "");
    }
  }
  return parseFloat(val) || 0;
}

function parseCompetitorsFromHtml(html: string, sourceUrl: string): any[] {
  const $ = cheerio.load(html);
  const competitors: any[] = [];

  // VARIANT A & B & D (Tables)
  const tables = $("table").toArray();
  
  for (const table of tables) {
    let nameCol = -1;
    let priceCol = -1;
    let rankCol = -1;
    let statusCol = -1;
    
    // Scan headers to map columns
    $(table).find("tr").each((rIdx, tr) => {
      const cells = $(tr).find("th, td");
      cells.each((cIdx, cell) => {
        const textVal = $(cell).text().trim().toLowerCase();
        if (textVal.includes("naziv") || textVal.includes("ponuđač") || textVal.includes("ponudjac") || textVal.includes("firma")) {
          nameCol = cIdx;
        } else if (textVal.includes("cijena") || textVal.includes("vrijednost") || textVal.includes("iznos")) {
          priceCol = cIdx;
        } else if (textVal.includes("rang") || textVal.includes("red. br") || textVal.includes("redni")) {
          rankCol = cIdx;
        } else if (textVal.includes("status") || textVal.includes("prihva") || textVal.includes("ocjena")) {
          statusCol = cIdx;
        }
      });
      if (nameCol !== -1 && priceCol !== -1) return false; // break scan
      return true;
    });

    // Parse data rows
    $(table).find("tr").each((rIdx, tr) => {
      const cells = $(tr).find("td");
      if (cells.length < 2) return; // Skip headers / empty rows
      
      let companyName = "";
      if (nameCol !== -1 && nameCol < cells.length) {
        companyName = $(cells[nameCol]).text().trim();
      } else {
        companyName = $(cells[0]).text().trim();
      }
      
      // Skip if this is a header row or placeholder
      if (
        !companyName || 
        companyName.toLowerCase().includes("naziv") || 
        companyName.toLowerCase().includes("ponuđač") ||
        companyName.toLowerCase().includes("ponudjac") ||
        companyName.toLowerCase().includes("ukupno")
      ) {
        return;
      }

      let priceText = "";
      if (priceCol !== -1 && priceCol < cells.length) {
        priceText = $(cells[priceCol]).text().trim();
      } else if (cells.length >= 2) {
        priceText = $(cells[1]).text().trim();
      }
      const offeredPriceKM = parsePrice(priceText);

      let rankText = "";
      if (rankCol !== -1 && rankCol < cells.length) {
        rankText = $(cells[rankCol]).text().trim();
      } else if (cells.length >= 3) {
        rankText = $(cells[2]).text().trim();
      }
      let rank = parseInt(rankText, 10) || null;
      if (rankText.toLowerCase() === "i" || rankText.toLowerCase().includes("prv")) rank = 1;

      let statusText = "";
      if (statusCol !== -1 && statusCol < cells.length) {
        statusText = $(cells[statusCol]).text().trim().toLowerCase();
      } else if (cells.length >= 4) {
        statusText = $(cells[3]).text().trim().toLowerCase();
      }

      const rowText = $(tr).text().toLowerCase();
      const isWinnerByStatus = rowText.includes("prihvaćena") || rowText.includes("prihvacena") || rowText.includes("izabrana") || rowText.includes("najniža") || rowText.includes("izabran");
      const isWinnerByRank = rank === 1;
      const hasWinnerStyle = $(tr).hasClass("winner") || $(tr).attr("style")?.includes("bold") || $(tr).attr("style")?.includes("green") || $(tr).find("b, strong").length > 0;

      const isWinner = isWinnerByRank || (rank === null && isWinnerByStatus) || hasWinnerStyle;
      
      let status = isWinner ? "Prihvaćena" : "Odbijena";
      if (statusText.includes("odbij")) status = "Odbijena";
      else if (statusText.includes("prihv")) status = "Prihvaćena";

      if (companyName && companyName.length > 2) {
        competitors.push({
          companyName,
          offeredPriceKM,
          isWinner,
          rank,
          status,
          rejectionReason: status === "Odbijena" ? "Nije izabran / nepovoljna ponuda" : null,
          sourceUrl
        });
      }
    });
  }

  // VARIANT C (Div sections)
  if (competitors.length === 0) {
    $(".ponudjac, div.ponudjac, .competitor-item").each((i, div) => {
      const companyName = $(div).find(".naziv, .name, h4, h3").text().trim() || $(div).text().trim().split("\n")[0].trim();
      const priceText = $(div).find(".cijena, .price, .amount").text().trim() || $(div).text().trim();
      const offeredPriceKM = parsePrice(priceText);
      const textVal = $(div).text().toLowerCase();
      const isWinner = textVal.includes("prihvaćena") || textVal.includes("prihvacena") || textVal.includes("izabrana") || textVal.includes("pobjednik") || textVal.includes("1.") || textVal.includes("najniža");
      const rank = isWinner ? 1 : null;
      const status = isWinner ? "Prihvaćena" : "Odbijena";

      if (companyName && companyName.length > 2) {
        competitors.push({
          companyName,
          offeredPriceKM,
          isWinner,
          rank,
          status,
          rejectionReason: null,
          sourceUrl
        });
      }
    });
  }

  return competitors;
}

export async function scrapeCompetitors(tenderId: string, explicitEjnId?: number): Promise<any[]> {
  const tender = await db.query.tendersTable.findFirst({
    where: eq(tendersTable.id, tenderId)
  });
  if (!tender) throw new Error("Tender not found");

  let ejnId: number | null = explicitEjnId || null;
  if (!ejnId) {
    const rawData = tender.rawData as any;
    if (rawData && rawData.Id) {
      ejnId = typeof rawData.Id === "number" ? rawData.Id : parseInt(rawData.Id, 10);
    } else if (rawData && rawData.announcement && rawData.announcement.Id) {
      ejnId = typeof rawData.announcement.Id === "number" ? rawData.announcement.Id : parseInt(rawData.announcement.Id, 10);
    }
  }

  if (!ejnId) {
    const match = tender.sourceUrl?.match(/id=(\d+)/);
    if (match) {
      ejnId = parseInt(match[1], 10);
    } else if (tender.externalId && /^\d+$/.test(tender.externalId)) {
      ejnId = parseInt(tender.externalId, 10);
    } else {
      throw new Error("Cannot find numeric EJN ID for tender");
    }
  }

  const client = await EjnSessionManager.getInstance().getAuthedClient();
  const relatedUrl = `https://www.ejn.gov.ba/Announcement/RelatedAnnouncements/${ejnId}`;
  
  console.log('[EJN Konkurencija] Related URL:', relatedUrl);
  
  const relRes = await client.get(relatedUrl);
  const $ = cheerio.load(relRes.data);
  const rows = $("table tbody tr").toArray();
  
  let dodjelaUrl = "";
  for (const row of rows) {
    const columns = $(row).find("td");
    if (columns.length >= 4) {
      const typeText = $(columns[1]).text().trim().toLowerCase();
      const href = $(columns[0]).find("a").attr("href");
      
      if (typeText.includes("dodjela") && href) {
        dodjelaUrl = href.startsWith("http") ? href : `https://www.ejn.gov.ba${href}`;
        break;
      }
    }
  }

  let html = "";
  let competitors: any[] = [];

  if (dodjelaUrl) {
    console.log('[EJN Konkurencija] Dodjela URL:', dodjelaUrl);
    try {
      const awardRes = await client.get(dodjelaUrl);
      html = awardRes.data;
      console.log('[EJN Konkurencija] Raw HTML snippet:', html.substring(0, 500));
      competitors = parseCompetitorsFromHtml(html, dodjelaUrl);
    } catch (e: any) {
      logger.error(`Failed to extract competitors from ${dodjelaUrl}: ${e.message}`);
    }
  }

  // Fallback to AwardDetails if no competitors found or no dodjela URL found
  if (competitors.length === 0) {
    const fallbackUrl = `https://www.ejn.gov.ba/Announcement/AwardDetails/${ejnId}`;
    console.log('[EJN Konkurencija] Related URL:', relatedUrl);
    console.log('[EJN Konkurencija] Dodjela URL (Fallback):', fallbackUrl);
    try {
      const fallbackRes = await client.get(fallbackUrl);
      html = fallbackRes.data;
      console.log('[EJN Konkurencija] Raw HTML snippet (Fallback):', html.substring(0, 500));
      competitors = parseCompetitorsFromHtml(html, fallbackUrl);
    } catch (e: any) {
      logger.error(`Failed to extract competitors from fallback ${fallbackUrl}: ${e.message}`);
    }
  }

  // Post-process competitors list (sort and rank)
  if (competitors.length > 0) {
    const hasWinner = competitors.some(c => c.isWinner);
    if (!hasWinner) {
      let lowestPriceIdx = 0;
      let minPrice = Infinity;
      competitors.forEach((c, idx) => {
        if (c.offeredPriceKM > 0 && c.offeredPriceKM < minPrice) {
          minPrice = c.offeredPriceKM;
          lowestPriceIdx = idx;
        }
      });
      competitors[lowestPriceIdx].isWinner = true;
      competitors[lowestPriceIdx].rank = 1;
      competitors[lowestPriceIdx].status = "Prihvaćena";
    }

    competitors.sort((a, b) => {
      if (a.isWinner && !b.isWinner) return -1;
      if (!a.isWinner && b.isWinner) return 1;
      if (a.rank && b.rank) return a.rank - b.rank;
      return a.offeredPriceKM - b.offeredPriceKM;
    });

    competitors.forEach((c, idx) => {
      c.rank = idx + 1;
      if (idx === 0) {
        c.isWinner = true;
        c.status = "Prihvaćena";
      } else {
        c.isWinner = false;
        c.status = c.status || "Odbijena";
      }
    });
  } else {
    // If absolutely no competitor data found, register "DODJELA_BEZ_PODATAKA"
    competitors.push({
      companyName: "Detalji nisu javno dostupni",
      offeredPriceKM: 0,
      isWinner: false,
      rank: 1,
      status: "DODJELA_BEZ_PODATAKA",
      rejectionReason: null,
      sourceUrl: dodjelaUrl || `https://www.ejn.gov.ba/Announcement/AwardDetails/${ejnId}`
    });
  }

  console.log('[EJN Konkurencija] Parsed competitors:', competitors);

  // Save to database
  await db.delete(tenderCompetitorsTable).where(eq(tenderCompetitorsTable.tenderId, tenderId));
  for (const comp of competitors) {
    await db.insert(tenderCompetitorsTable).values({
      id: nanoid(),
      tenderId,
      companyName: comp.companyName,
      offeredPriceKM: comp.offeredPriceKM,
      isWinner: comp.isWinner,
      rank: comp.rank,
      status: comp.status,
      rejectionReason: comp.rejectionReason,
      sourceUrl: comp.sourceUrl,
      scrapedAt: new Date()
    });
  }

  return competitors;
}
