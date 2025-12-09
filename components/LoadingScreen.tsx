"use client";

import { useMemo } from "react";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { LoadingSpinner } from "./LoadingSpinner";
import { ACCENT_COLORS } from "@/lib/utils";

interface LoadingScreenProps {
    message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
    const randomColor = useMemo(() => {
        return ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    }, []);

    return (
        <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
            <div className="text-center">
                <Image
                    src={CartSenseLogo}
                    alt="CartSense"
                    width={48}
                    height={48}
                    className="mx-auto mb-4"
                />
                <LoadingSpinner
                    size="lg"
                    color="custom"
                    customColor={randomColor.primary}
                    className="mx-auto mb-3"
                />
                <p className="text-gray-500">{message}</p>
            </div>
        </div>
    );
}
