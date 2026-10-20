import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Shows server-side validation messages on the matching form fields. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[]> | undefined,
) {
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages[0]) setError(field as Path<T>, { message: messages[0] });
  }
}
