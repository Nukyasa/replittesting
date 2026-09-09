import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import { logger } from "../lib/logger";
import * as cheerio from "cheerio";

export class EjnSessionManager {
  private static instance: EjnSessionManager;
  private client: AxiosInstance;
  private cookieJar: CookieJar;
  private isAuthenticated: boolean = false;
  private isAuthenticating: boolean = false;
  private lastAuthTime: number = 0;
  private authPromise: Promise<void> | null = null;
  private readonly SESSION_EXPIRY_MS = 20 * 60 * 1000; // 20 minuta

  private constructor() {
    this.cookieJar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.cookieJar,
        withCredentials: true,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: 30000, // 30s
      })
    );
  }

  public static getInstance(): EjnSessionManager {
    if (!EjnSessionManager.instance) {
      EjnSessionManager.instance = new EjnSessionManager();
    }
    return EjnSessionManager.instance;
  }

  /**
   * Vraća autentificirani Axios klijent. Ako sesija nije aktivna, pokreće login.
   */
  public async getAuthedClient(): Promise<AxiosInstance> {
    const now = Date.now();
    // Ako smo nedavno provjerili/prijavili, smatramo da je ok
    if (this.isAuthenticated && (now - this.lastAuthTime) < this.SESSION_EXPIRY_MS) {
      return this.client;
    }

    // Ako je neko drugi vec pozvao login, sacekaj ga
    if (this.isAuthenticating && this.authPromise) {
      await this.authPromise;
      return this.client;
    }

    // Pokreni login proces
    this.isAuthenticating = true;
    this.authPromise = this.login();

    try {
      await this.authPromise;
      this.isAuthenticated = true;
      this.lastAuthTime = Date.now();
    } catch (err) {
      this.isAuthenticated = false;
      throw err;
    } finally {
      this.isAuthenticating = false;
      this.authPromise = null;
    }

    return this.client;
  }

  private async login(): Promise<void> {
    try {
      logger.info("Započinjem autentifikaciju na EJN...");
      const username = process.env.EJN_USERNAME || process.env.EJN_USER;
      const password = process.env.EJN_PASSWORD || process.env.EJN_PASS;

      if (!username || !password) {
        throw new Error("EJN kredencijali nisu konfigurisani u .env fajlu");
      }

      // 1. Fetch Home/Index to get initial csrfToken
      const homeRes = await this.client.get("https://www.ejn.gov.ba/Home/Index");
      
      const match = homeRes.data.match(/var\s+csrfToken\s*=\s*'([^']+)'/);
      const csrfToken = match ? match[1] : null;

      if (!csrfToken) {
        throw new Error("Nije pronađen csrfToken na Home/Index stranici");
      }

      // 2. Post login as JSON
      const postRes = await this.client.post("https://www.ejn.gov.ba/Profile/SignIn", {
        UserName: username,
        Password: password
      }, {
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://www.ejn.gov.ba/Home/Index",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "x-jsonrequestverificationtoken": csrfToken
        },
        validateStatus: () => true
      });

      if (postRes.status !== 200) {
        throw new Error(`Login POST odgovorio sa statusom: ${postRes.status}`);
      }

      // 3. Provjera da li smo logirani (provjerom kolačića)
      const cookies = await this.cookieJar.getCookies("https://www.ejn.gov.ba");
      if (!cookies.some(c => c.key === "EPSAuth")) {
        throw new Error("Login nije uspio, EPSAuth kolačić nije postavljen.");
      }

      logger.info("Uspješna EJN autentifikacija");
    } catch (error: any) {
      logger.error({ message: error.message, status: error.response?.status }, "Greška prilikom EJN autentifikacije");
      throw new Error("Prijava na EJN nije uspjela. Provjerite podešeni račun direktno na portalu.");
    }
  }

  /**
   * Resetira sesiju (brise cookie) i status
   */
  public resetSession() {
    this.cookieJar.removeAllCookiesSync();
    this.isAuthenticated = false;
    this.lastAuthTime = 0;
  }
}
