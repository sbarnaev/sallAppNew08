import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "neutral" | "success" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function Button(props: Props) {
  const { className, variant = "primary", size = "md", fullWidth, ...rest } = props;
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "secondary"
        ? "btn-secondary"
        : variant === "neutral"
          ? "btn-neutral"
          : variant === "success"
            ? "btn-success"
            : variant === "danger"
              ? "btn-danger"
              : "btn-ghost";
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : undefined;
  return (
    <button
      {...rest}
      className={clsx(
        "btn",
        variantClass,
        sizeClass,
        fullWidth && "w-full",
        className
      )}
    />
  );
}
