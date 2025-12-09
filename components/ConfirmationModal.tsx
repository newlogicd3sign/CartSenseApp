"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    icon: ReactNode;
    title: string;
    description: string | ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    loading?: boolean;
}

const variantStyles = {
    danger: {
        iconBg: "bg-red-100",
        confirmBtn: "bg-red-500 hover:bg-red-600 text-white",
    },
    warning: {
        iconBg: "bg-amber-100",
        confirmBtn: "bg-amber-500 hover:bg-amber-600 text-white",
    },
    info: {
        iconBg: "bg-blue-100",
        confirmBtn: "bg-blue-500 hover:bg-blue-600 text-white",
    },
};

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    icon,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
    loading = false,
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 animate-scale-up shadow-xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>

                <div className="text-center">
                    <div className={`w-12 h-12 ${styles.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        {icon}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
                    <div className="text-sm text-gray-500 mb-6">{description}</div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${styles.confirmBtn}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
