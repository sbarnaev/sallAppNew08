import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={clsx(
        "rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white",
        "px-6 py-3 font-semibold text-sm",
        "shadow-lg shadow-brand-500/20",
        "hover:from-brand-700 hover:to-brand-800",
        "hover:shadow-xl hover:shadow-brand-500/30",
        "active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        "transition-all duration-300 ease-out",
        "border-0",
        className
      )}
    />
  );
}
