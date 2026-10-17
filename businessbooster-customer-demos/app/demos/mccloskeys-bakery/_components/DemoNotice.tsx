import { getDemoBySlug } from "@/lib/demos";

const demo = getDemoBySlug("mccloskeys-bakery")!;

export function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[0.78rem] leading-snug ${className}`}>
      <span className="font-semibold">Concept preview.</span> {demo.disclaimer}
    </p>
  );
}
