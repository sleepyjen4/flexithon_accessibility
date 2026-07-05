import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border border-line bg-surface p-6 shadow-card ${className}`}
      {...props}
    />
  );
}
