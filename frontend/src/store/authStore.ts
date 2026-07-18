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
  hydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
  hydrate: () => void;
};

const TOKEN_KEY = "rm_token";
const USER_KEY = "rm_user";

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, hydrated: true });
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, hydrated: true });
  },
  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    // Drop legacy shared "demo" sessions — they synced every phone to one account.
    if (!token || !raw || token === "demo") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ token: null, user: null, hydrated: true });
      return;
    }
    try {
      const user = JSON.parse(raw) as AuthUser;
      set({ token, user, hydrated: true });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ token: null, user: null, hydrated: true });
    }
  },
}));

useAuthStore.getState().hydrate();
