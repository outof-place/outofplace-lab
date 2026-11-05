"use client";

import { useSyncExternalStore, version } from "react";

const subscribe = () => () => {};

// The server snapshot (null) is used on the server and during hydration, so the version shows
// only once the React that runs in the browser renders this component.
export function BrowserReactVersion() {
  const browser = useSyncExternalStore(subscribe, () => version, () => null);
  return browser ?? "not hydrated yet";
}
