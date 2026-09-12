import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-foreground outline-none ring-primary placeholder:text-slate-500 focus:ring-2",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
