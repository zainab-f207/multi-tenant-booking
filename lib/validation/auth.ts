

import { z } from "zod";

const email = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters");

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const onboardingSchema = z
  .object({
    organizationName: z.string().min(2, "Organization name is required"),
    organizationSlug: z
      .string()
      .min(2, "Slug is required")
      .regex(
        slugPattern,
        "Slug can only contain lowercase letters, numbers and hyphens (e.g. acme-inc)"
      ),
    adminName: z.string().min(2, "Full name is required"),
    adminEmail: email,
    password,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    email,
    password,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;