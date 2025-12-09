"use client";

import { type ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    className?: string;
    padding?: "none" | "sm" | "md" | "lg";
    hover?: boolean;
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
    action?: ReactNode;
}

interface CardBodyProps {
    children: ReactNode;
    className?: string;
}

const paddingClasses = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
};

export function Card({ children, className = "", padding = "md", hover = false }: CardProps) {
    return (
        <div
            className={`bg-white rounded-2xl border border-gray-100 ${paddingClasses[padding]} ${
                hover ? "hover:shadow-md transition-shadow" : ""
            } ${className}`}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = "", action }: CardHeaderProps) {
    return (
        <div className={`flex items-center justify-between ${className}`}>
            <div>{children}</div>
            {action && <div>{action}</div>}
        </div>
    );
}

export function CardBody({ children, className = "" }: CardBodyProps) {
    return <div className={className}>{children}</div>;
}
