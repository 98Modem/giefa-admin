"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const serverSnapshot = () => "UTC";
const browserSnapshot = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function useBrowserTimeZone() {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
