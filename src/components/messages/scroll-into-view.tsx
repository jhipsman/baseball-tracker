"use client";

import { useEffect } from "react";

/** Scrolls the element with this id into view once (e.g. a linked announcement). */
export function ScrollIntoView({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [id]);
  return null;
}
