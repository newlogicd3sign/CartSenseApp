"use client";

import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    icon?: ReactNode;
    iconPosition?: "left" | "right";
    fullWidth?: boolean;
    gradientColors?: { primary: string; dark: string };
    children: ReactNode;
}

const variantClasses = {
    primary: "bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white shadow-lg hover:shadow-xl",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline: "bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50",
    ghost: "bg-[#4A90E2]/10 text-[#4A90E2] hover:bg-[#4A90E2]/20",
    danger: "bg-red-500 text-white hover:bg-red-600",
};

const sizeClasses = {
    sm: "px-3 py-2 text-sm rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
};

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconPosition = "left",
    fullWidth = false,
    gradientColors,
    children,
    className = "",
    disabled,
    style,
    ...props
}: ButtonProps) {
    const baseClasses = "font-medium transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2";

    const customStyle = gradientColors
        ? { background: `linear-gradient(to right, ${gradientColors.primary}, ${gradientColors.dark})`, ...style }
        : style;

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
            disabled={disabled || loading}
            style={customStyle}
            {...props}
        >
            {loading ? (
                <>
                    <LoadingSpinner size="sm" color={variant === "primary" || variant === "danger" ? "white" : "primary"} />
                    <span>{children}</span>
                </>
            ) : (
                <>
                    {icon && iconPosition === "left" && icon}
                    <span>{children}</span>
                    {icon && iconPosition === "right" && icon}
                </>
            )}
        </button>
    );
}
