import { randomUUID } from "node:crypto";
import type {
  GreenApiContact,
  GreenApiJournalMessage,
} from "../../domain/whatsapp.js";
import { logger } from "../utils/logger.js";

type JsonObject = Record<string, unknown>;

export class GreenApiClient {
  private readonly apiBaseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor() {
    this.apiBaseUrl = String(process.env.GREEN_API_BASE_URL || "").trim().replace(/\/+$/, "");
    this.token = String(process.env.GREEN_API_TOKEN || "").trim();
    this.timeoutMs = Number(process.env.GREEN_API_TIMEOUT_MS || 8000);

    if (!this.apiBaseUrl || !this.token) {
      throw new Error("GREEN_API_BASE_URL e GREEN_API_TOKEN são obrigatórios.");
    }
  }

  private async get<T>(path: string, query?: URLSearchParams): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const requestId = randomUUID();
    const querySuffix = query && [...query.keys()].length > 0 ? `?${query.toString()}` : "";
    const url = `${this.apiBaseUrl}/${path}/${this.token}${querySuffix}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        logger.warn("green_api_get_error", {
          requestId,
          path,
          status: response.status,
          payload,
        });
        throw new Error(`Falha ao consultar ${path}.`);
      }

      return payload as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async post<T>(path: string, body: JsonObject): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const requestId = randomUUID();
    const url = `${this.apiBaseUrl}/${path}/${this.token}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        logger.warn("green_api_post_error", {
          requestId,
          path,
          status: response.status,
          payload,
        });
        throw new Error(`Falha ao consultar ${path}.`);
      }

      return payload as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getContacts(): Promise<GreenApiContact[]> {
    return this.get<GreenApiContact[]>("getContacts");
  }

  async getGroups(): Promise<GreenApiContact[]> {
    return this.get<GreenApiContact[]>(
      "getContacts",
      new URLSearchParams({
        group: "true",
      })
    );
  }

  async getContactInfo(chatId: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("getContactInfo", { chatId });
  }

  async getGroupData(groupId: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("getGroupData", { groupId });
  }

  async getChatHistory(chatId: string, count = 100): Promise<GreenApiJournalMessage[]> {
    return this.post<GreenApiJournalMessage[]>("getChatHistory", { chatId, count });
  }

  async lastIncomingMessages(minutes: number): Promise<GreenApiJournalMessage[]> {
    return this.get<GreenApiJournalMessage[]>(
      "lastIncomingMessages",
      new URLSearchParams({
        minutes: String(Math.max(1, Math.floor(minutes))),
      })
    );
  }

  async lastOutgoingMessages(minutes: number): Promise<GreenApiJournalMessage[]> {
    return this.get<GreenApiJournalMessage[]>(
      "lastOutgoingMessages",
      new URLSearchParams({
        minutes: String(Math.max(1, Math.floor(minutes))),
      })
    );
  }
}
