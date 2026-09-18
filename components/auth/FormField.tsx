
type RegisterProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

type FormFieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
  register: RegisterProps;
  autoComplete?: string;
};

export default function FormField({
  id,
  label,
  type = "text",
  placeholder,
  icon,
  error,
  register,
  autoComplete,
}: FormFieldProps) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-200 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-lg bg-white/[0.06] border ${
            error ? "border-rose-400/70 animate-shake" : "border-white/15"
          } ${icon ? "pl-10" : "pl-3.5"} pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60
          transition-colors duration-150`}
          {...register}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}