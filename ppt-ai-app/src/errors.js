/**
 * Application-level error with public serialization support.
 */
export class AppError extends Error {
  /**
   * Creates an application error.
   * @param {{code: string, status: number, message: string, details?: unknown}} input
   */
  constructor({ code, status, message, details }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /**
   * Converts this error to a public API response body.
   * @param {string} requestId
   * @returns {{error: {code: string, message: string, request_id: string}}}
   */
  toJSON(requestId) {
    return {
      error: {
        code: this.code,
        message: this.message,
        request_id: requestId,
      },
    };
  }
}

/**
 * Converts unknown errors into application errors.
 * @param {unknown} error
 * @returns {AppError}
 */
export function normalizeError(error) {
  if (error instanceof AppError) return error;
  return new AppError({
    code: "INTERNAL_ERROR",
    status: 500,
    message: "Internal server error",
    details: error,
  });
}
