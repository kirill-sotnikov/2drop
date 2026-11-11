"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { DropClient, initialState } from "../lib/client";
import { SessionContext, type SessionValue } from "../lib/session-context";
import { UiError } from "../lib/ui-error";

export const SessionProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [state, setState] = useState(initialState);
  const client = useRef<DropClient | null>(null);

  useEffect(() => {
    const instance = new DropClient(setState);

    client.current = instance;

    // Strict Mode cleans up its first effect before this microtask runs.
    queueMicrotask(instance.connect);

    const pagehide = () => instance.dispose();

    // A page restored from the back/forward cache needs a fresh socket and engine.
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) location.reload();
    };

    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);

    return () => {
      client.current = null;
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
      instance.dispose();
    };
  }, []);

  const actions = useMemo<Omit<SessionValue, "state">>(
    () => ({
      lookup: (id) =>
        client.current?.lookup(id) ??
        Promise.reject(new UiError("errors.connecting")),
      propose: (...args) => client.current?.propose(...args),
      decide: (accept) => client.current?.decide(accept),
      cancel: () => client.current?.cancel(),
      rotate: () => client.current?.rotate(),
      discardReceived: () => client.current?.discardReceived(),
      clearError: () => client.current?.clearError(),
    }),
    [],
  );

  const value = useMemo(() => ({ state, ...actions }), [actions, state]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};
