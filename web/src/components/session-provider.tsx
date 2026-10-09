"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DropClient, initialState, type ClientState } from "../lib/client";

type SessionContext = {
  state: ClientState;
  lookup: DropClient["lookup"];
  propose: DropClient["propose"];
  decide: DropClient["decide"];
  cancel: DropClient["cancel"];
  rotate: DropClient["rotate"];
  discardReceived: DropClient["discardReceived"];
  clearError: DropClient["clearError"];
};
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
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
  const actions = useMemo<Omit<SessionContext, "state">>(
    () => ({
      lookup: (id) =>
        client.current?.lookup(id) ??
        Promise.reject(new Error("Подключаемся к серверу.")),
      propose: (...args) => client.current?.propose(...args),
      decide: (accept) => client.current?.decide(accept),
      cancel: () => client.current?.cancel(),
      rotate: () => client.current?.rotate(),
      discardReceived: () => client.current?.discardReceived(),
      clearError: () => client.current?.clearError(),
    }),
    [],
  );
  return (
    <Context.Provider value={{ state, ...actions }}>
      {children}
    </Context.Provider>
  );
}

export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("SessionProvider is missing");
  return context;
}
