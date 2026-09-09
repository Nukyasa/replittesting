/// <reference lib="dom" />
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { nanoid } from "./nanoid";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { logger } from "./logger";
import AdmZip from "adm-zip";

export async function fetchDocumentsForTender(tenderId: string, noticeNumber: string) {
  const username = process.env.EJN_USERNAME || process.env.EJN_USER;
  const password = process.env.EJN_PASSWORD || process.env.EJN_PASS;
  if (!username || !password) throw new Error("EJN_USERNAME and EJN_PASSWORD are required.");
  logger.info({ tenderId, noticeNumber }, "Starting EJN Scraper");
  
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });

  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fsSync.existsSync(uploadDir)) {
    fsSync.mkdirSync(uploadDir, { recursive: true });
  }
  
  const downloadDir = path.join(process.cwd(), "tmp_downloads", tenderId);
  await fs.mkdir(downloadDir, { recursive: true });

  const insertedDocs = [];

  try {
    const page = await browser.newPage();
    
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });

    logger.info("Navigating to EJN login...");
    await page.goto("https://www.ejn.gov.ba/Profile/SignIn", { waitUntil: "networkidle2" });
    
    await page.type("#Username", username);
    await page.type("#Password", password);
    
    logger.info("Clicking login...");
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    
    await page.goto("https://www.ejn.gov.ba/Announcement/Search", { waitUntil: "networkidle2" });
    
    await page.waitForSelector("#Broj", { visible: true });
    await page.type("#Broj", noticeNumber);
    
    await page.evaluate(() => {
      const btn = document.querySelector(".btn-search") as HTMLElement;
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    const actions = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll(".dropdown-menu a")) as HTMLAnchorElement[];
      return links.map((l, i) => ({ text: l.textContent?.trim() || "", href: l.href, index: i }));
    });
    
    logger.info({ actions }, "Found actions");

    const preuzmiLink = actions.find(a => a.text.includes("Preuzmi"));
    const tenderskaLinkIndex = actions.findIndex(a => a.text.includes("Tenderska"));

    // Function to wait for file download in dir
    const waitForDownload = async (dir: string, timeout = 30000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const files = await fs.readdir(dir);
        const downloading = files.some(f => f.endsWith('.crdownload') || f.endsWith('.tmp'));
        if (files.length > 0 && !downloading) {
          return files[0];
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      return null;
    };

    if (preuzmiLink && preuzmiLink.href) {
      logger.info(`Downloading Preuzmi PDF: ${preuzmiLink.href}`);
      await page.goto(preuzmiLink.href, { waitUntil: "networkidle2" });
      const downloadedFile = await waitForDownload(downloadDir);
      if (downloadedFile) {
        const oldPath = path.join(downloadDir, downloadedFile);
        const newFileName = `${nanoid()}.pdf`;
        const newPath = path.join(uploadDir, newFileName);
        await fs.rename(oldPath, newPath);
        
        const docId = nanoid();
        await db.insert(documentsTable).values({
          id: docId,
          tenderId,
          name: "Obavještenje_o_nabavci.pdf",
          originalUrl: `file://${newPath}`,
          fileType: "PDF",
          uploadedAt: new Date()
        });
        insertedDocs.push({ id: docId, name: "Obavještenje_o_nabavci.pdf" });
      }
    }

    if (tenderskaLinkIndex !== -1) {
      logger.info(`Clicking Tenderska link at index ${tenderskaLinkIndex}`);
      
      await page.evaluate((idx) => {
        const links = Array.from(document.querySelectorAll(".dropdown-menu a")) as HTMLElement[];
        if (links[idx]) {
          links[idx].click();
        }
      }, tenderskaLinkIndex);
      
      await new Promise(r => setTimeout(r, 3000));
      
      // Look for download buttons
      const hasDownloadBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("a, button")) as HTMLElement[];
        const downloadBtn = btns.find(b => b.textContent?.toLowerCase().includes("preuzmi") || b.textContent?.toLowerCase().includes("download"));
        if (downloadBtn) {
          downloadBtn.click();
          return true;
        }
        return false;
      });

      if (hasDownloadBtn) {
        logger.info("Clicked download on Tenderska page, waiting for file...");
        const downloadedFile = await waitForDownload(downloadDir, 60000); // 60s for large zip
        if (downloadedFile) {
          const ext = path.extname(downloadedFile).toLowerCase();
          const oldPath = path.join(downloadDir, downloadedFile);
          
          if (ext === ".zip") {
            const zip = new AdmZip(oldPath);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
              if (!entry.isDirectory) {
                const extractedPath = path.join(uploadDir, `${nanoid()}-${entry.name}`);
                fsSync.writeFileSync(extractedPath, entry.getData());
                
                const ext = entry.name.split('.').pop()?.toUpperCase() || "FILE";
                const docId = nanoid();
                await db.insert(documentsTable).values({
                  id: docId,
                  tenderId,
                  name: entry.name,
                  originalUrl: `file://${extractedPath}`,
                  fileType: ext,
                  uploadedAt: new Date()
                });
                insertedDocs.push({ id: docId, name: entry.name });
              }
            }
          } else {
             const newFileName = `${nanoid()}${ext}`;
             const newPath = path.join(uploadDir, newFileName);
             await fs.rename(oldPath, newPath);
             
             const docId = nanoid();
             await db.insert(documentsTable).values({
               id: docId,
               tenderId,
               name: downloadedFile,
               originalUrl: `file://${newPath}`,
               fileType: ext.replace(".", "").toUpperCase(),
               uploadedAt: new Date()
             });
             insertedDocs.push({ id: docId, name: downloadedFile });
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed in EJN Scraper");
  } finally {
    await browser.close();
    // Cleanup tmp dir
    try {
      await fs.rm(downloadDir, { recursive: true, force: true });
    } catch(e) {}
  }
  
  return insertedDocs;
}
