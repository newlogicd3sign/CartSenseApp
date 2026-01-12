"use client";

import { useState, useEffect, useRef } from "react";

interface MealImageProps {
    src?: string | null;
    alt: string;
    className?: string;
    iconClassName?: string;
    isPremium?: boolean;
}

export function MealImage({ src, alt, className = "", iconClassName = "w-8 h-8", isPremium = false }: MealImageProps) {
    const [error, setError] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const prevSrcRef = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        // Only reset state if src actually changed to a different value
        if (prevSrcRef.current !== src) {
            setError(false);
            setLoaded(false);
            prevSrcRef.current = src;
        }
    }, [src]);

    // If no src provided or error occurred, show fallback immediately
    if (!src || error) {
        return (
            <div className={`relative flex items-center justify-center bg-gradient-to-br from-orange-50/50 to-orange-100/50 ${className}`}>
                {/* Pattern Overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`
                }} />

                {/* Center Badge */}
                <div className="relative z-10 p-4 rounded-full bg-white/60 backdrop-blur-sm shadow-sm flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={isPremium ? "/CartSenseProLogo.svg" : "/CartSenseLogo.svg"}
                        alt={isPremium ? "CartSense Pro Logo" : "CartSense Logo"}
                        className={`opacity-50 ${iconClassName}`}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
            {/* Loading Skeleton */}
            {!loaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse" />
            )}

            {/* Image */}
            <img
                src={src}
                alt={alt}
                className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                ref={(img) => {
                    // If image is already complete (cached), mark as loaded immediately
                    if (img && img.complete && img.naturalHeight !== 0 && !loaded && !error) {
                        setLoaded(true);
                    }
                }}
            />
        </div>
    );
}
