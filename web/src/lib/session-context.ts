"use client";

import { createContext, useContext } from "react";
import { type ClientState, type DropClient } from "./client";

export interface SessionValue {
  state: ClientState;
  lookup: DropClient["lookup"];
  propose: DropClient["propose"];
  decide: DropClient["decide"];
  cancel: DropClient["cancel"];
  rotate: DropClient["rotate"];
  discardReceived: DropClient["discardReceived"];
  clearError: DropClient["clearError"];
}

export const SessionContext = createContext<SessionValue | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) throw new Error("SessionProvider is missing");

  return context;
};
