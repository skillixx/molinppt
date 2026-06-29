/**
 * Minimal structured JSON logger.
 */
export class Logger {
  /**
   * Creates a logger.
   * @param {{level?: string, sink?: {write(message: string): void}}} input
   */
  constructor({ level = "info", sink = process.stdout } = {}) {
    this.level = level;
    this.sink = sink;
  }

  /** @param {string} event @param {object} metadata */
  debug(event, metadata = {}) {
    this.#write("debug", event, metadata);
  }

  /** @param {string} event @param {object} metadata */
  info(event, metadata = {}) {
    this.#write("info", event, metadata);
  }

  /** @param {string} event @param {object} metadata */
  warn(event, metadata = {}) {
    this.#write("warn", event, metadata);
  }

  /** @param {string} event @param {object} metadata */
  error(event, metadata = {}) {
    this.#write("error", event, metadata);
  }

  /**
   * Writes a redacted structured log line.
   * @param {string} level
   * @param {string} event
   * @param {object} metadata
   */
  #write(level, event, metadata) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...redact(metadata),
    };
    this.sink.write(`${JSON.stringify(entry)}\n`);
  }
}

/**
 * Redacts sensitive metadata keys recursively.
 * @param {unknown} value
 * @returns {unknown}
 */
export function redact(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item));
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|password|secret|api_key|authorization/i.test(key)) {
      output[key] = "[REDACTED]";
    } else {
      output[key] = redact(item);
    }
  }
  return output;
}
