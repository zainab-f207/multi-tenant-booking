"use client";

import { useState } from "react";
import Link from "next/link";
import { loginSchema } from "@/lib/validation/auth";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import DemoNotice from "@/components/auth/DemoNotice";
import { MailIcon, LockIcon } from "@/components/auth/icons";

type FormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialState: FormState = { email: "", password: "", rememberMe: false };

export default function LoginPage() {
  const [values, setValues] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(field: keyof FormState, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(false);

    const result = loginSchema.safeParse(values);
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
    // Simulated delay — no backend wired up yet in Week 1.
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your organization's bookings"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-indigo-300 hover:text-indigo-200 font-medium">
            Register
          </Link>
          <span className="mx-2 text-slate-600">·</span>
          <Link href="/onboarding" className="text-indigo-300 hover:text-indigo-200 font-medium">
            Create an organization
          </Link>
        </>
      }
    >
      {submitted && (
        <DemoNotice message="Form validated successfully. Backend authentication will be connected in a later implementation." />
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
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange("email", e.target.value),
          }}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          icon={<LockIcon />}
          error={errors.password}
          autoComplete="current-password"
          register={{
            value: values.password,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange("password", e.target.value),
          }}
        />

        <div className="flex items-center justify-between mb-6 -mt-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={values.rememberMe}
              onChange={(e) => handleChange("rememberMe", e.target.checked)}
              className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-400/60"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm text-indigo-300 hover:text-indigo-200">
            Forgot password?
          </Link>
        </div>

        <SubmitButton loading={loading}>Login</SubmitButton>
      </form>
    </AuthShell>
  );
}