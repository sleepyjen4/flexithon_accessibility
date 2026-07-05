import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "accent";
  /** Render styles onto the child element (e.g. a Link) instead of a <button>,
   * so we never nest interactive elements. */
  asChild?: boolean;
};

/** Pill buttons, three intents: ink for the main path, outlined for everything
 * that must stay a visible-but-quieter choice (skip is never hidden), raspberry
 * for a single celebratory CTA per screen at most. Focus ring comes from the
 * global :focus-visible rule so it adapts on dark surfaces. */
export function Button({
  variant = "primary",
  asChild = false,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-ink text-milk hover:bg-[#3a332b]",
    secondary: "border-2 border-ink bg-surface text-ink hover:bg-mint",
    accent: "bg-raspberry text-milk hover:bg-[#8f2a47]",
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
