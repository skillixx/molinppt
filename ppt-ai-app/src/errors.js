/**
 * Application-level error with public serialization support.
 */
export class AppError extends Error {
  /**
   * Creates an application error.
   * @param {{code: string, status: number, message: string, details?: unknown, publicDetails?: unknown}} input
   */
  constructor({ code, status, message, details, publicDetails }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.publicDetails = publicDetails;
  }

  /**
   * Converts this error to a public API response body.
   * @param {string} requestId
   * @returns {{error: {code: string, message: string, request_id: string, details?: unknown}}}
   */
  toJSON(requestId) {
    const payload = {
      error: {
        code: this.code,
        message: this.message,
        request_id: requestId,
      },
    };
    if (this.publicDetails !== undefined) payload.error.details = this.publicDetails;
    return payload;
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
