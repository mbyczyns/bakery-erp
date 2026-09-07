"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export type UserRole = "ADMIN" | "MANAGER" | "BAKER";

export interface AuthUser {
    id: string;
    login: string;
    name: string | null;
    role: UserRole;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    hasRole: (roles: UserRole | UserRole[]) => boolean;
    canAccessPath: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMe = async () => {
        try {
            const res = await fetch("/api/auth/me");
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMe();
    }, []);

    const login = async (loginStr: string, passwordStr: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: loginStr, password: passwordStr }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setUser(data.user);
                // Używamy window.location.href, aby przeglądarka załadowała świeży stan sesji i ciasteczka
                window.location.href = "/produkcja";
                return { success: true };
            } else {
                return { success: false, error: data.error || "Nieprawidłowy login lub hasło" };
            }
        } catch (err: any) {
            return { success: false, error: err.message || "Błąd połączenia z serwerem" };
        }
    };

    const logout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (err) {
            console.error("Błąd wylogowania:", err);
        } finally {
            setUser(null);
            window.location.href = "/login";
        }
    };

    const hasRole = (roles: UserRole | UserRole[]): boolean => {
        if (!user) return false;
        if (Array.isArray(roles)) {
            return roles.includes(user.role);
        }
        return user.role === roles;
    };

    const canAccessPath = (path: string): boolean => {
        if (!user) return false;
        if (user.role === "ADMIN" || user.role === "MANAGER") return true;

        if (user.role === "BAKER") {
            const allowed = ["/produkcja", "/skladniki", "/przepisy"];
            return allowed.some((p) => path.startsWith(p));
        }

        return false;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                login,
                logout,
                refreshUser: fetchMe,
                hasRole,
                canAccessPath,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
