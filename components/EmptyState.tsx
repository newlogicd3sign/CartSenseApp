"use client";

import { type ReactNode } from "react";

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        variant?: "primary" | "gradient";
        gradientColors?: { primary: string; dark: string };
    };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 mb-6">{description}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    style={
                        action.variant === "gradient" && action.gradientColors
                            ? {
                                  background: `linear-gradient(to right, ${action.gradientColors.primary}, ${action.gradientColors.dark})`,
                              }
                            : undefined
                    }
                    className={
                        action.variant === "gradient"
                            ? "px-6 py-3 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                            : "px-6 py-3 bg-[#4A90E2]/10 text-[#4A90E2] rounded-xl hover:bg-[#4A90E2]/20 transition-colors"
                    }
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
