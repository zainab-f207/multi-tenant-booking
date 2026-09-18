"use client";

import { useState } from "react";
import Link from "next/link";
import { registerSchema } from "@/lib/validation/auth";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import DemoNotice from "@/components/auth/DemoNotice";
import { UserIcon, MailIcon, LockIcon } from "@/components/auth/icons";

type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialState: FormState = { fullName: "", email: "", password: "", confirmPassword: "" };

export default function RegisterPage() {
  const [values, setValues] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(field: keyof FormState, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(false);

    const result = registerSchema.safeParse(values);
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
      title="Create your account"
      subtitle="Join an existing organization on Multi-Tenant Booking"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-300 hover:text-indigo-200 font-medium">
            Login
          </Link>
        </>
      }
    >
      {submitted && (
        <DemoNotice message="Form validated successfully. Backend authentication will be connected in a later implementation." />
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          id="fullName"
          label="Full name"
          placeholder="Ayesha Khan"
          icon={<UserIcon />}
          error={errors.fullName}
          autoComplete="name"
          register={{
            value: values.fullName,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange("fullName", e.target.value),
          }}
        />
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
          placeholder="At least 8 characters"
          icon={<LockIcon />}
          error={errors.password}
          autoComplete="new-password"
          register={{
            value: values.password,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange("password", e.target.value),
          }}
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          placeholder="Re-enter your password"
          icon={<LockIcon />}
          error={errors.confirmPassword}
          autoComplete="new-password"
          register={{
            value: values.confirmPassword,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange("confirmPassword", e.target.value),
          }}
        />

        <SubmitButton loading={loading}>Register</SubmitButton>
      </form>
    </AuthShell>
  );
}