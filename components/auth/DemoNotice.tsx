
import { CheckCircleIcon } from "./icons";

export default function DemoNotice({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 animate-fade-in-up">
      <CheckCircleIcon className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
      <p className="text-sm text-emerald-100">{message}</p>
    </div>
  );
}