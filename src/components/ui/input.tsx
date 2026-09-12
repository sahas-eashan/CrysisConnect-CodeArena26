import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground outline-none ring-primary placeholder:text-slate-400 transition focus:border-primary/40 focus:bg-slate-950/70 focus:ring-2",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
