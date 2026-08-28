export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  badRequest: (message: string) => new AppError(400, "BAD_REQUEST", message),
  unauthorized: (message = "Sign in required") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You cannot do that") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new AppError(404, "NOT_FOUND", message),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
};
