"use client";

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg";
    color?: "primary" | "white" | "gray" | "purple" | "red" | "custom";
    customColor?: string;
    className?: string;
}

const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
    lg: "w-10 h-10 border-3",
};

const colorClasses = {
    primary: "border-gray-200 border-t-[#4A90E2]",
    white: "border-white/30 border-t-white",
    gray: "border-gray-200 border-t-gray-500",
    purple: "border-gray-200 border-t-purple-500",
    red: "border-gray-300 border-t-red-500",
    custom: "border-gray-200",
};

export function LoadingSpinner({
    size = "md",
    color = "primary",
    customColor,
    className = "",
}: LoadingSpinnerProps) {
    const style = color === "custom" && customColor
        ? { borderTopColor: customColor }
        : undefined;

    return (
        <div
            className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin ${className}`}
            style={style}
        />
    );
}
