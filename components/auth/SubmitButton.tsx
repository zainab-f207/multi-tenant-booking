
import { SpinnerIcon } from "./icons";

type SubmitButtonProps = {
  loading: boolean;
  children: React.ReactNode;
};

export default function SubmitButton({ loading, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg
      bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500
      disabled:opacity-60 disabled:cursor-not-allowed
      text-white text-sm font-medium py-2.5 px-4
      shadow-lg shadow-indigo-900/30
      transition-all duration-150 active:scale-[0.98]"
    >
      {loading && <SpinnerIcon />}
      {loading ? "Please wait…" : children}
    </button>
  );
}