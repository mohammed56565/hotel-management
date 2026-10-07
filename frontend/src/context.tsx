import { createContext, useContext, type ReactNode } from "react";
import type { Hotel, User } from "./types";
export interface AppContextValue {
  user: User;
  hotel: Hotel;
  refresh: () => void;
  version: number;
  notify: (message: string) => void;
  setUser: (user: User) => void;
}
export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);
export function Provider({
  value,
  children,
}: {
  value: AppContextValue;
  children: ReactNode;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
