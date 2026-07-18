import { create } from "zustand";

export type AuthUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
  hydrate: () => void;
};

const TOKEN_KEY = "rm_token";
const USER_KEY = "rm_user";

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
  hydrate: () => {
    const demoUser: AuthUser = {
      id: 0,
      username: "demo",
      full_name: "דניאל כהן",
      role: "team_leader",
    };
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) {
      set({ token: "demo", user: demoUser });
      return;
    }
    try {
      const user = JSON.parse(raw) as AuthUser;
      set({ token, user });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ token: "demo", user: demoUser });
    }
  },
}));

// Ensure token exists before any query mounts (avoids race with useEffect hydrate).
useAuthStore.getState().hydrate();
