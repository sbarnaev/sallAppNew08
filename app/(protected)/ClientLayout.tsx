"use client";

import { useEffect } from "react";
import { setupApiInterceptor } from "@/lib/api-interceptor";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  // Настраиваем перехватчик API запросов для обработки ошибок 403
  useEffect(() => {
    setupApiInterceptor();
  }, []);

  return <>{children}</>;
}

