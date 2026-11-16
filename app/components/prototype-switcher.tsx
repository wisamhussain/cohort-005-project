// PROTOTYPE — throwaway. Floating variant switcher for UI prototypes.
// Cycles the `?variant=` search param. Hidden in production builds.
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PrototypeVariant {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  children,
}: {
  variants: PrototypeVariant[];
  children?: React.ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentKey = searchParams.get("variant") ?? variants[0].key;
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === currentKey)
  );
  const current = variants[index];

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("variant", next.key);
        return p;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
      <span className="rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        Prototype
      </span>
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/15"
        title="Previous variant (←)"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-48 text-center font-medium">
        {current.key} ({current.name})
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/15"
        title="Next variant (→)"
      >
        <ChevronRight className="size-4" />
      </button>
      {children}
    </div>
  );
}
