import { z } from "zod";

export const signupRoleSchema = z.enum([
  "CREATOR",
  "OPERATOR",
  "MANUFACTURER",
  "DESIGNER",
  "PACKAGING_PARTNER",
  "PHOTOGRAPHER",
  "LAWYER",
  "MARKETING_AGENCY",
  "WAREHOUSE",
  "INVESTOR",
]);

export const signInSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(12).max(128),
});

export const signUpSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number"),
  role: signupRoleSchema.default("CREATOR"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
