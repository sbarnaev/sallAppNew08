"use client";

import { useState } from "react";
import { ClientSearchModal } from "./ClientSearchModal";

export function ClientSearchButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-2xl bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200 border border-blue-200 text-sm md:text-base whitespace-nowrap text-center"
      >
        Новый расчёт
      </button>
      <ClientSearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

