"use client";

import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    variant?: "center" | "bottom-sheet";
    size?: "sm" | "md" | "lg" | "xl";
    showCloseButton?: boolean;
}

const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
};

export function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    variant = "center",
    size = "md",
    showCloseButton = true,
}: ModalProps) {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const isBottomSheet = variant === "bottom-sheet";

    return (
        <div
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex ${
                isBottomSheet ? "items-end sm:items-center" : "items-center"
            } justify-center p-4`}
        >
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal content */}
            <div
                className={`relative bg-white w-full ${sizeClasses[size]} ${
                    isBottomSheet
                        ? "rounded-t-2xl sm:rounded-2xl max-h-[85vh]"
                        : "rounded-2xl max-h-[90vh]"
                } flex flex-col overflow-hidden shadow-xl animate-scale-up`}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                        <div>
                            {title && (
                                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                            )}
                            {subtitle && (
                                <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                {/* Footer */}
                {footer && (
                    <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
