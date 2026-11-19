export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (message: string, details?: unknown) => new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Please sign in again") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have access to this") => new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "Record") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);

/** The database wraps its message one level down, so look at the cause too. */
export const isUniqueViolation = (e: unknown) => {
  const x = e as { message?: string; code?: string; cause?: { message?: string; code?: string } };
  return /UNIQUE|SQLITE_CONSTRAINT/i.test(`${x?.message} ${x?.code} ${x?.cause?.message} ${x?.cause?.code}`);
};
