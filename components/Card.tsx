import { ReactNode } from "react";
import { clsx } from "clsx";

export function Card({ 
  children, 
  className,
  hover = true,
  muted = false
}: { 
  children: ReactNode;
  className?: string;
  hover?: boolean;
  muted?: boolean;
}) {
  return (
    <div 
      className={clsx(
        muted ? "card-muted" : "card",
        hover && !muted && "hover:shadow-soft-lg hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}
