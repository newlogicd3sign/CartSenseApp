"use client";

import { useMemo } from "react";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { Loader2 } from "lucide-react";
import { ACCENT_COLORS } from "@/lib/utils";

interface LoadingScreenProps {
    message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
    const randomColor = useMemo(() => {
        return ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    }, []);

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center p-4">
            <div className="relative">
                {/* Logo */}
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 relative z-10">
                    <Image
                        src={CartSenseLogo}
                        alt="Loading..."
                        className="w-10 h-10 animate-pulse"
                    />
                </div>

                {/* Spinning Ring */}
                <div className="absolute inset-0 -m-1 rounded-3xl border-2 border-[#4A90E2]/20 animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-0 -m-1 rounded-3xl border-t-2 border-[#4A90E2] animate-[spin_1.5s_linear_infinite]" />
            </div>

            <p className="text-sm font-medium text-gray-400 mt-4 animate-pulse">
                {message}
            </p>
        </div>
    );
}
