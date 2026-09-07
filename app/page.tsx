"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function RootPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (user) {
                router.replace("/produkcja");
            } else {
                router.replace("/login");
            }
        }
    }, [user, isLoading, router]);

    return (
        <div className="min-h-screen bg-ui-white flex items-center justify-center text-ui-secondary">
            <Loader2 size={32} className="animate-spin text-ui-primary" />
        </div>
    );
}