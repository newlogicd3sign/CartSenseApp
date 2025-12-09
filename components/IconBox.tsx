"use client";

import { type ReactNode } from "react";

interface IconBoxProps {
    children: ReactNode;
    size?: "sm" | "md" | "lg";
    variant?: "primary" | "success" | "warning" | "error" | "purple" | "gray";
    className?: string;
}

const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
};

const variantClasses = {
    primary: "bg-[#4A90E2]/10 text-[#4A90E2]",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    error: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    gray: "bg-gray-100 text-gray-500",
};

export function IconBox({
    children,
    size = "md",
    variant = "primary",
    className = "",
}: IconBoxProps) {
    return (
        <div
            className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-xl flex items-center justify-center flex-shrink-0 ${className}`}
        >
            {children}
        </div>
    );
}
