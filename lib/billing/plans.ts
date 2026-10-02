
export const PLAN_KEYS = ["basic", "pro"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export function isValidPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as readonly string[]).includes(value);
}

interface PlanConfig {
  key: PlanKey;
  label: string;
  stripePriceId: string;
}

function requirePriceEnv(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Missing ${varName}. Set it in .env to use the "${varName}" plan.`);
  }
  return value;
}

export function getPlanConfig(planKey: PlanKey): PlanConfig {
  switch (planKey) {
    case "basic":
      return { key: "basic", label: "Basic", stripePriceId: requirePriceEnv("STRIPE_PRICE_ID_BASIC") };
    case "pro":
      return { key: "pro", label: "Pro", stripePriceId: requirePriceEnv("STRIPE_PRICE_ID_PRO") };
  }
}