import { ReactNode } from "react";
import { clsx } from "clsx";

export function Card({ 
  children, 
  className,
  hover = true 
}: { 
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div 
      className={clsx(
        "card",
        hover && "hover:shadow-soft-lg hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}
