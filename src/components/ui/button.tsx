import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "success" | "warning";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-slate-950 hover:bg-sky-300",
        variant === "secondary" && "bg-secondary text-slate-950 hover:bg-amber-300",
        variant === "outline" && "border border-slate-700 bg-transparent text-foreground hover:bg-slate-900",
        variant === "danger" && "bg-danger text-white hover:bg-red-500",
        variant === "success" && "bg-success text-slate-950 hover:bg-emerald-300",
        variant === "warning" && "bg-secondary text-slate-950 hover:bg-yellow-300",
        variant === "ghost" && "bg-transparent text-foreground hover:bg-slate-900",
        className
      )}
      type={type}
      {...props}
    />
  );
}
