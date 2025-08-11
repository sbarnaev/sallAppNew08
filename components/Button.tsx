import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={clsx(
        "rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 disabled:opacity-60",
        className
      )}
    />
  );
}
