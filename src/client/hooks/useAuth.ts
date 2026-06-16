// =============================================================================
// client/hooks/useAuth
// /oauth/me を叩いてログイン状態を解決するフック。
// =============================================================================

import { useEffect, useState } from "react";
import type { AuthUser } from "../types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/oauth/me")
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{
              authenticated: boolean;
              email: string;
              name: string;
              picture: string;
            }>)
          : null
      )
      .then((data) => {
        if (data?.authenticated) {
          setUser({
            email: data.email,
            name: data.name,
            picture: data.picture
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
