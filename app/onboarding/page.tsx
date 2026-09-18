"use client";

import { useState } from "react";
import Link from "next/link";
import { onboardingSchema } from "@/lib/validation/auth";
import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import DemoNotice from "@/components/auth/DemoNotice";
import { BuildingIcon, LinkIcon, UserIcon, MailIcon, LockIcon } from "@/components/auth/icons";

type FormState = {
  organizationName: string;
  organizationSlug: string;
  adminName: string;
  adminEmail: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialState: FormState = {
  organizationName: "",
  organizationSlug: "",
  adminName: "",
  adminEmail: "",
  password: "",
  confirmPassword: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function OnboardingPage() {
  const [values, setValues] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  function handleChange(field: keyof FormState, value: string) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate slug from org name until the user edits it manually
      if (field === "organizationName" && !slugTouched) {
        next.organizationSlug = slugify(value);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(false);

    const result = onboardingSchema.safeParse(values);
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
      title="Create your organization"
      subtitle="Set up a new tenant on Multi-Tenant Booking"
      footer={
        <>
          Already have an organization?{" "}
          <Link href="/login" className="text-indigo-300 hover:text-indigo-200 font-medium">
            Login
          </Link>
        </>
      }
    >
      {submitted && (
        <DemoNotice message="Organization details validated successfully. Backend account creation will be connected in a later implementation." />
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          id="organizationName"
          label="Organization name"
          placeholder="Acme Inc."
          icon={<BuildingIcon />}
          error={errors.organizationName}
          register={{
            value: values.organizationName,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange("organizationName", e.target.value),
          }}
        />
        <FormField
          id="organizationSlug"
          label="Organization slug"
          placeholder="acme-inc"
          icon={<LinkIcon />}
          error={errors.organizationSlug}
          register={{
            value: values.organizationSlug,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              setSlugTouched(true);
              handleChange("organizationSlug", e.target.value);
            },
          }}
        />
        <FormField
          id="adminName"
          label="Admin full name"
          placeholder="Ayesha Khan"
          icon={<UserIcon />}
          error={errors.adminName}
          autoComplete="name"
          register={{
            value: values.adminName,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange("adminName", e.target.value),
          }}
        />
        <FormField
          id="adminEmail"
          label="Admin email"
          type="email"
          placeholder="admin@company.com"
          icon={<MailIcon />}
          error={errors.adminEmail}
          autoComplete="email"
          register={{
            value: values.adminEmail,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange("adminEmail", e.target.value),
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

        <SubmitButton loading={loading}>Create Organization</SubmitButton>
      </form>
    </AuthShell>
  );
}