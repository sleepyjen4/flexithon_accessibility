import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  /** Render styles onto the child element (e.g. a Link) instead of a <button>,
   * so we never nest interactive elements. */
  asChild?: boolean;
};

export function Button({
  variant = "primary",
  asChild = false,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-6 text-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary:
      "border border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100",
  };
  const Component = asChild ? Slot : "button";

  return (
    <Component
      suppressHydrationWarning
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
