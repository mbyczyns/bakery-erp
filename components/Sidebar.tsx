"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, ShoppingCart, Cookie, TrendingUp, TrendingDown, DollarSign, ReceiptEuroIcon, FileText, Settings } from "lucide-react";

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();

    // Menu aplikacji - linki i ikony
    const menuItems = [
        { name: "Strona główna", href: "/", icon: Home },
        { name: "Faktury i paragony", href: "/faktury", icon: ReceiptEuroIcon },
        { name: "Dostawcy i kontrahenci", href: "/kontrahenci", icon: ShoppingCart },
        { name: "Przepisy i foodcosty", href: "/przepisy", icon: FileText },
        { name: "Produkcja i sprzedaż", href: "/produkcja", icon: Cookie },
        { name: "Przychody", href: "/przychody", icon: TrendingUp },
        { name: "Koszty", href: "/koszty", icon: TrendingDown },
        { name: "Finanse", href: "/finanse", icon: DollarSign },
        { name: "Konfiguracja", href: "/konfiguracja", icon: Settings },
    ];

    return (
        <div className={`relative flex flex-col bg-ui-primary text-ui-white h-screen p-5 pt-8 duration-300 ${isCollapsed ? "w-20" : "w-68"}`}>

            {/* Przycisk do chowania / rozwijania */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute flex items-center justify-center -right-3 top-9 w-7 h-7 bg-ui-accent text-ui-primary rounded-full border-2 border-ui-primary cursor-pointer hover:bg-ui-accent duration-200"
            >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Lista sekcji (Linki) */}
            <nav className="flex-1 space-y-2">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-x-4 p-3 rounded-lg cursor-pointer transition-colors duration-200
                ${isActive ? "bg-ui-accent text-ui-primary" : "text-ui-white hover:bg-ui-accent hover:text-ui-primaryy"}
              `}
                        >
                            <Icon size={20} className="shrink-0" />
                            <span className={`origin-left duration-200 whitespace-nowrap ${isCollapsed ? "scale-0 w-0 opacity-0" : "scale-100"}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}