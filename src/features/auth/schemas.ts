import { z } from "zod";

/**
 * Form schemas shared by the client (React Hook Form) and the server actions.
 * They take a translator so the same rules produce localized messages on both
 * sides; keys live in the "Validation" namespace of messages/*.json.
 */

export type ValidationKey =
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordWeak"
  | "passwordsDontMatch"
  | "nameTooShort"
  | "nameTooLong"
  | "codeInvalid";

export type Translate = (key: ValidationKey) => string;

const email = (t: Translate) =>
  z.string().trim().toLowerCase().pipe(z.email({ error: t("emailInvalid") }));

// bcrypt only uses the first 72 bytes of a password, hence the upper bound.
const newPassword = (t: Translate) =>
  z
    .string()
    .min(8, { error: t("passwordTooShort") })
    .max(72, { error: t("passwordTooLong") })
    .regex(/[A-Za-z]/, { error: t("passwordWeak") })
    .regex(/\d/, { error: t("passwordWeak") });

export const twoFactorCode = (t: Translate) =>
  z.string().trim().regex(/^\d{6}$/, { error: t("codeInvalid") });

export const loginSchema = (t: Translate) =>
  z.object({
    email: email(t),
    password: z.string().min(1, { error: t("passwordRequired") }).max(128),
    // Only sent on the second step, after the server asked for it.
    // A 6-digit authenticator code or a recovery code ("k3m9x-q7w2a").
    code: z
      .union([
        z.literal(""),
        twoFactorCode(t),
        z.string().trim().regex(/^[a-z0-9]{5}[\s-]?[a-z0-9]{5}$/i, { error: t("codeInvalid") }),
      ])
      .optional(),
  });

export const registerSchema = (t: Translate) =>
  z
    .object({
      name: z
        .string()
        .trim()
        .min(2, { error: t("nameTooShort") })
        .max(50, { error: t("nameTooLong") }),
      email: email(t),
      password: newPassword(t),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      error: t("passwordsDontMatch"),
    });

export const emailOnlySchema = (t: Translate) => z.object({ email: email(t) });

export const resetPasswordSchema = (t: Translate) =>
  z
    .object({ password: newPassword(t), confirmPassword: z.string() })
    .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], error: t("passwordsDontMatch") });

export const twoFactorCodeSchema = (t: Translate) => z.object({ code: twoFactorCode(t) });

export type LoginInput = z.input<ReturnType<typeof loginSchema>>;
export type RegisterInput = z.input<ReturnType<typeof registerSchema>>;
export type EmailOnlyInput = z.input<ReturnType<typeof emailOnlySchema>>;
export type ResetPasswordInput = z.input<ReturnType<typeof resetPasswordSchema>>;
export type TwoFactorCodeInput = z.input<ReturnType<typeof twoFactorCodeSchema>>;
