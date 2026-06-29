import { AppError } from "./errors.js";

/**
 * Client wrapper for Moling internal platform APIs.
 */
export class MolingClient {
  /**
   * Creates a Moling API client.
   * @param {{baseUrl: string, internalToken: string, fetcher?: typeof fetch}} input
   */
  constructor({ baseUrl, internalToken, fetcher = fetch }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.internalToken = internalToken;
    this.fetcher = fetcher;
  }

  /**
   * Verifies a one-time Moling application launch ticket.
   * @param {string} ticket
   * @returns {Promise<object>}
   */
  verifyLaunchTicket(ticket) {
    return this.postInternal("/api/internal/app-launch/verify", { launch_ticket: ticket });
  }

  /**
   * Sends an internal POST request to Moling.
   * @param {string} pathName
   * @param {object} body
   * @returns {Promise<object>}
   */
  async postInternal(pathName, body) {
    return this.#request(pathName, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Sends an internal GET request to Moling.
   * @param {string} pathName
   * @returns {Promise<object>}
   */
  async getInternal(pathName) {
    return this.#request(pathName, { method: "GET" });
  }

  /**
   * Handles Moling envelope parsing and error mapping.
   * @param {string} pathName
   * @param {RequestInit} init
   * @returns {Promise<object>}
   */
  async #request(pathName, init) {
    const response = await this.fetcher(`${this.baseUrl}${pathName}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": this.internalToken,
        ...(init.headers || {}),
      },
    });
    const envelope = await response.json();
    if (!response.ok || envelope.code !== 0) {
      throw new AppError({
        code: String(envelope.code || response.status),
        status: response.status,
        message: envelope.message || "Moling request failed",
        details: envelope.data,
      });
    }
    return envelope.data;
  }
}

/**
 * Local Moling-compatible client for deterministic acceptance testing.
 */
export class LocalMolingClient {
  /**
   * Creates a local Moling client.
   * @param {{userId: number, appId?: number, productId?: number, entitlementId: number, initialCredits?: string}} input
   */
  constructor({ userId, appId = 15, productId = 73, entitlementId, initialCredits = "100" }) {
    this.userId = Number(userId);
    this.appId = Number(appId);
    this.productId = Number(productId);
    this.entitlementId = Number(entitlementId);
    this.total = Number(initialCredits);
    this.used = 0;
    this.reserved = 0;
    this.holds = new Map();
    this.nextHoldId = 1;
  }

  /**
   * Verifies a local launch ticket.
   * @param {string} ticket
   * @returns {Promise<object>}
   */
  async verifyLaunchTicket(ticket) {
    if (!ticket) throw new AppError({ code: "40003", status: 403, message: "Invalid local launch ticket" });
    return { user_id: this.userId, app_id: this.appId, product_id: this.productId };
  }

  /**
   * Handles local Moling GET endpoints.
   * @param {string} pathName
   * @returns {Promise<object>}
   */
  async getInternal(pathName) {
    if (pathName.startsWith("/api/internal/entitlement-balance")) {
      const url = new URL(pathName, "http://local");
      this.#assertUserAndEntitlement({
        user_id: Number(url.searchParams.get("user_id")),
        entitlement_id: Number(url.searchParams.get("entitlement_id")),
      });
      return this.#balance();
    }
    throw new AppError({ code: "NOT_FOUND", status: 404, message: "Local Moling endpoint not found" });
  }

  /**
   * Handles local Moling POST endpoints.
   * @param {string} pathName
   * @param {object} body
   * @returns {Promise<object>}
   */
  async postInternal(pathName, body) {
    if (pathName === "/api/internal/app-launch/verify") return this.verifyLaunchTicket(body.launch_ticket);
    if (pathName === "/api/internal/entitlement-reserve") return this.#reserve(body);
    if (pathName === "/api/internal/entitlement-settle") return this.#settle(body);
    if (pathName === "/api/internal/entitlement-release") return this.#release(body);
    if (pathName === "/api/internal/entitlement-consume") return this.#consume(body);
    throw new AppError({ code: "NOT_FOUND", status: 404, message: "Local Moling endpoint not found" });
  }

  /**
   * Reserves local credits.
   * @param {object} body
   * @returns {object}
   */
  #reserve(body) {
    this.#assertUserAndEntitlement(body);
    const amount = Number(body.amount);
    if (this.#available() < amount) {
      throw new AppError({ code: "60005", status: 400, message: "Insufficient local credits" });
    }
    const holdId = this.nextHoldId++;
    this.reserved += amount;
    this.holds.set(holdId, { amount, status: "reserved" });
    return { hold_id: holdId, reserved: body.amount, available: String(this.#available()), status: "reserved" };
  }

  /**
   * Settles a local hold.
   * @param {object} body
   * @returns {object}
   */
  #settle(body) {
    const hold = this.#getHold(body.hold_id);
    const actual = Number(body.actual_amount);
    this.reserved -= hold.amount;
    this.used += actual;
    hold.status = "settled";
    return { ...this.#balance(), hold_id: Number(body.hold_id), status: "settled", settled_amount: body.actual_amount };
  }

  /**
   * Releases a local hold.
   * @param {object} body
   * @returns {object}
   */
  #release(body) {
    const hold = this.#getHold(body.hold_id);
    this.reserved -= hold.amount;
    hold.status = "released";
    return { ...this.#balance(), hold_id: Number(body.hold_id), status: "released", settled_amount: "0" };
  }

  /**
   * Consumes local credits immediately.
   * @param {object} body
   * @returns {object}
   */
  #consume(body) {
    this.#assertUserAndEntitlement(body);
    const amount = Number(body.amount);
    if (this.#available() < amount) {
      throw new AppError({ code: "60005", status: 400, message: "Insufficient local credits" });
    }
    this.used += amount;
    return { status: "consumed", amount: body.amount, ...this.#balance() };
  }

  /**
   * Returns local balance.
   * @returns {object}
   */
  #balance() {
    return {
      entitlement_id: this.entitlementId,
      user_id: this.userId,
      quota_total: String(this.total),
      quota_used: String(this.used),
      quota_reserved: String(this.reserved),
      remaining: String(this.#available()),
      status: "active",
      usable: true,
    };
  }

  /**
   * Computes available credits.
   * @returns {number}
   */
  #available() {
    return this.total - this.used - this.reserved;
  }

  /**
   * Validates local user and entitlement ownership.
   * @param {object} body
   * @returns {void}
   */
  #assertUserAndEntitlement(body) {
    if (Number(body.user_id) !== this.userId || Number(body.entitlement_id) !== this.entitlementId) {
      throw new AppError({ code: "40003", status: 403, message: "Local entitlement does not belong to user" });
    }
  }

  /**
   * Finds a hold by ID.
   * @param {number} holdId
   * @returns {object}
   */
  #getHold(holdId) {
    const hold = this.holds.get(Number(holdId));
    if (!hold || hold.status !== "reserved") {
      throw new AppError({ code: "40400", status: 404, message: "Local hold not found" });
    }
    return hold;
  }
}
