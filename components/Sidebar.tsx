"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    ChevronLeft,
    ChevronRight,
    ShoppingCart,
    DollarSign,
    ReceiptEuroIcon,
    FileText,
    Settings,
    Microwave,
    Milk,
    LogOut,
    Bell
} from "lucide-react";

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [notificationsCount, setNotificationsCount] = useState<number>(0);
    const pathname = usePathname();
    const { user, logout, canAccessPath } = useAuth();

    const fetchNotificationsCount = async () => {
        try {
            const res = await fetch("/api/powiadomienia");
            if (res.ok) {
                const data = await res.json();
                setNotificationsCount(data.summary?.totalCount || 0);
            }
        } catch {
            // cichy fallback
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotificationsCount();
            const interval = setInterval(fetchNotificationsCount, 30000); // odświeżaj co 30s
            return () => clearInterval(interval);
        }
    }, [user, pathname]);

    // Pełne menu aplikacji - linki i ikony (Powiadomienia przeniesione na dół nad profil)
    const allMenuItems = [
        { name: "Faktury", href: "/faktury", icon: ReceiptEuroIcon },
        { name: "Dostawcy i kontrahenci", href: "/kontrahenci", icon: ShoppingCart },
        { name: "Produkcja i sprzedaż", href: "/produkcja", icon: Microwave },
        { name: "Składniki", href: "/skladniki", icon: Milk },
        { name: "Przepisy i foodcosty", href: "/przepisy", icon: FileText },
        { name: "Finanse", href: "/finanse", icon: DollarSign },
        { name: "Konfiguracja", href: "/konfiguracja", icon: Settings },
    ];

    // Filtrowanie menu wg uprawnień roli
    const visibleMenuItems = allMenuItems.filter((item) => {
        if (!user) return true;
        return canAccessPath(item.href);
    });

    const isNotificationsActive =
        pathname === "/powiadomienia" || pathname.startsWith("/powiadomienia/");

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case "ADMIN":
                return { label: "ADMIN", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
            case "MANAGER":
                return { label: "MANAGER", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" };
            case "BAKER":
                return { label: "PRACOWNIK", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
            default:
                return { label: role || "USER", color: "bg-gray-500/20 text-gray-300 border-gray-500/40" };
        }
    };

    const roleBadge = getRoleBadge(user?.role);

    return (
        <div className={`relative flex flex-col justify-between bg-ui-primary text-ui-white h-screen p-5 pt-8 duration-300 ${isCollapsed ? "w-20" : "w-68"}`}>

            {/* Przycisk do chowania / rozwijania */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute flex items-center justify-center -right-3 top-9 w-7 h-7 bg-ui-accent text-ui-primary rounded-full border-2 border-ui-primary cursor-pointer hover:bg-ui-accent duration-200 shadow-md z-20"
                title={isCollapsed ? "Rozwiń menu" : "Zwiń menu"}
            >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Lista sekcji (Główne linki) */}
            <div className="flex-1 overflow-y-auto">
                <nav className="space-y-1.5">
                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`) ||
                            (item.href === "/finanse" && (pathname.startsWith("/przychody") || pathname.startsWith("/koszty")));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${isActive
                                        ? "bg-ui-accent text-ui-primary font-bold shadow-xs"
                                        : "text-ui-white/80 hover:bg-ui-white/10 hover:text-ui-white font-medium"
                                    }`}
                                title={isCollapsed ? item.name : undefined}
                            >
                                <div className="flex items-center gap-x-4 min-w-0">
                                    <div className="relative shrink-0">
                                        <Icon size={20} />
                                    </div>
                                    <span className={`origin-left duration-200 whitespace-nowrap text-sm ${isCollapsed ? "scale-0 w-0 opacity-0 hidden" : "scale-100"}`}>
                                        {item.name}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Dolna sekcja: Powiadomienia + Profil użytkownika */}
            <div className="pt-3 border-t border-ui-white/15 space-y-2">
                {/* Powiadomienia tuż nad profilem */}
                {canAccessPath("/powiadomienia") && (
                    <Link
                        href="/powiadomienia"
                        className={`relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${isNotificationsActive
                                ? "bg-ui-accent text-ui-primary font-bold shadow-xs"
                                : "text-ui-white/80 hover:bg-ui-white/10 hover:text-ui-white font-medium"
                            }`}
                        title={isCollapsed ? (notificationsCount > 0 ? `Powiadomienia (${notificationsCount})` : "Powiadomienia") : undefined}
                    >
                        <div className="flex items-center gap-x-4 min-w-0">
                            <div className="relative shrink-0">
                                <Bell size={20} />
                                {notificationsCount > 0 && isCollapsed && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center animate-pulse shadow-sm">
                                        {notificationsCount > 9 ? "9+" : notificationsCount}
                                    </span>
                                )}
                            </div>
                            <span className={`origin-left duration-200 whitespace-nowrap text-sm ${isCollapsed ? "scale-0 w-0 opacity-0 hidden" : "scale-100"}`}>
                                Powiadomienia
                            </span>
                        </div>

                        {notificationsCount > 0 && !isCollapsed && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/90 text-white font-black text-[10px] shadow-2xs">
                                {notificationsCount}
                            </span>
                        )}
                    </Link>
                )}

                {/* Profil zalogowanego użytkownika i wylogowanie */}
                {user && (
                    <div className="pt-1">
                        {!isCollapsed ? (
                            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-ui-white/5 border border-ui-white/10">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-black text-xs shrink-0">
                                        {(user.name || user.login).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-ui-white truncate">
                                            {user.name || user.login}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${roleBadge.color}`}>
                                                {roleBadge.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => logout()}
                                    className="p-1.5 text-ui-white/60 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title="Wyloguj się"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div
                                    className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-xs"
                                    title={`${user.name || user.login} (${user.role})`}
                                >
                                    {(user.name || user.login).slice(0, 2).toUpperCase()}
                                </div>
                                <button
                                    onClick={() => logout()}
                                    className="p-2 text-ui-white/60 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Wyloguj się"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}