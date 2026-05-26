"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AiBasketsRoute() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/?tab=ai-baskets");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050811] flex flex-col items-center justify-center text-emerald-400 font-sans">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-emerald-500/15" />
        <div className="absolute inset-0 rounded-full border-4 border-t-emerald-400 animate-spin" />
      </div>
      <div className="animate-pulse text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
        Resolving AI Custom Scoring Desk...
      </div>
    </div>
  );
}
