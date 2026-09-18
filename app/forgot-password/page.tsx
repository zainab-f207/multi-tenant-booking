"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import DemoNotice from "@/components/auth/DemoNotice";
import { MailIcon } from "@/components/auth/icons";

type FormState = { email: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

export default function ForgotPasswordPage() {
  const [values, setValues] = useState<FormState>({ email: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(false);

    const result = forgotPasswordSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send a reset link to your email"
      footer={
        <Link href="/login" className="text-indigo-300 hover:text-indigo-200 font-medium">
          ← Back to login
        </Link>
      }
    >
      {submitted && (
        <DemoNotice message="Reset request validated. Email delivery will be connected in a later implementation." />
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          placeholder="you@company.com"
          icon={<MailIcon />}
          error={errors.email}
          autoComplete="email"
          register={{
            value: values.email,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setValues({ email: e.target.value }),
          }}
        />

        <SubmitButton loading={loading}>Send Reset Link</SubmitButton>
      </form>
    </AuthShell>
  );
}