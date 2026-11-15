"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "constellation:sidebar-collapsed";
const EVENT = "constellation:sidebar";

// Used when the browser refuses access to localStorage (private mode, blocked storage).
let memory = false;

function read(): boolean {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === null ? memory : stored === "1";
  } catch {
    return memory;
  }
}

function subscribe(notify: () => void): () => void {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/** Collapsed state of the sidebar, remembered between visits. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    memory = !read();
    try {
      window.localStorage.setItem(KEY, memory ? "1" : "0");
    } catch {
      // Keep the in-memory value only.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [collapsed, toggle];
}
