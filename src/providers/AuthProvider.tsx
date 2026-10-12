"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { RecordModel } from "pocketbase";
import { getPB } from "@/lib/pb";
import type { Business } from "@/lib/types";
import type { Role } from "@/config/roles";

interface AuthContextValue {
  user: (RecordModel & { name: string; role: Role; business: string }) | null;
  business: Business | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Sustituye el negocio en memoria (tras guardar ajustes) para que toda la app se actualice al instante. */
  updateBusiness: (b: Business) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  business: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  updateBusiness: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const pb = getPB();
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBusiness = useCallback(
    async (record: AuthContextValue["user"]) => {
      if (record?.business) {
        try {
          const b = await pb.collection("businesses").getOne(record.business);
          setBusiness(b as unknown as Business);
          return;
        } catch {
          /* sin negocio accesible */
        }
      }
      setBusiness(null);
    },
    [pb],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection("users").authRefresh();
        } catch {
          pb.authStore.clear();
        }
      }
      if (!alive) return;
      const record = pb.authStore.record as AuthContextValue["user"];
      setUser(record);
      await loadBusiness(record);
      if (alive) setLoading(false);
    })();

    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.record as AuthContextValue["user"]);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [pb, loadBusiness]);

  const login = useCallback(
    async (email: string, password: string) => {
      await pb.collection("users").authWithPassword(email, password);
      const record = pb.authStore.record as AuthContextValue["user"];
      setUser(record);
      await loadBusiness(record);
    },
    [pb, loadBusiness],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setBusiness(null);
  }, [pb]);

  return (
    <AuthContext.Provider value={{ user, business, loading, login, logout, updateBusiness: setBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
