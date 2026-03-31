export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiErrorResponse extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "ApiErrorResponse";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiErrorResponse) {
    return Response.json(error.toJSON(), { status: error.statusCode });
  }

  const fallback: ApiError = {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  };

  return Response.json(fallback, { status: 500 });
}
