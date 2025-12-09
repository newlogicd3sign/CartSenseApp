"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";

interface AlertProps {
    variant: "success" | "error" | "warning" | "info";
    icon?: ReactNode;
    title?: string;
    children: ReactNode;
    onClose?: () => void;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

const variantStyles = {
    success: {
        container: "bg-emerald-50 border-emerald-200",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        text: "text-emerald-800",
        title: "text-emerald-700",
        button: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
        closeHover: "hover:bg-emerald-100",
    },
    error: {
        container: "bg-red-50 border-red-200",
        iconBg: "bg-red-100",
        iconColor: "text-red-600",
        text: "text-red-800",
        title: "text-red-700",
        button: "bg-red-100 text-red-700 hover:bg-red-200",
        closeHover: "hover:bg-red-100",
    },
    warning: {
        container: "bg-amber-50 border-amber-200",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        text: "text-amber-800",
        title: "text-amber-700",
        button: "bg-amber-100 text-amber-700 hover:bg-amber-200",
        closeHover: "hover:bg-amber-100",
    },
    info: {
        container: "bg-blue-50 border-blue-200",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        text: "text-blue-800",
        title: "text-blue-700",
        button: "bg-blue-100 text-blue-700 hover:bg-blue-200",
        closeHover: "hover:bg-blue-100",
    },
};

export function Alert({
    variant,
    icon,
    title,
    children,
    onClose,
    action,
    className = "",
}: AlertProps) {
    const styles = variantStyles[variant];

    return (
        <div className={`border rounded-xl p-4 ${styles.container} ${className}`}>
            <div className="flex items-start gap-3">
                {icon && (
                    <div className={`w-8 h-8 ${styles.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <span className={styles.iconColor}>{icon}</span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    {title && (
                        <p className={`text-sm font-medium ${styles.title} mb-1`}>{title}</p>
                    )}
                    <div className={`text-sm ${styles.text}`}>{children}</div>
                    {action && (
                        <button
                            onClick={action.onClick}
                            className={`mt-3 px-4 py-2 rounded-xl text-sm transition-colors ${styles.button}`}
                        >
                            {action.label}
                        </button>
                    )}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${styles.closeHover}`}
                    >
                        <X className={`w-4 h-4 ${styles.iconColor}`} />
                    </button>
                )}
            </div>
        </div>
    );
}
