import { z } from "zod";

/**
 * Standard return shape for Server Actions and Route Handlers.
 * Raw errors never reach the client; they are logged server-side and mapped
 * to `{ success: false, message, code }`, which the UI shows with a toast.
 */

export type ActionSuccess<T> = { success: true; data: T };

export type ActionError = {
  success: false;
  message: string;
  /** HTTP-style status code: 400 validation, 401/403 auth, 404, 409, 429, 500. */
  code: number;
  /** Per-field validation messages, keyed by form field name. */
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = void> = ActionSuccess<T> | ActionError;

export function ok<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function fail(
  message: string,
  code = 400,
  fieldErrors?: Record<string, string[]>,
): ActionError {
  return fieldErrors ? { success: false, message, code, fieldErrors } : { success: false, message, code };
}

/** 400 result carrying the first message of each invalid field. */
export function failValidation(error: z.ZodError, message: string): ActionError {
  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(z.flattenError(error).fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) fieldErrors[field] = messages;
  }
  return fail(message, 400, fieldErrors);
}
