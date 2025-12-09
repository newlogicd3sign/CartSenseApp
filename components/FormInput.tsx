"use client";

import { type ReactNode, type InputHTMLAttributes, forwardRef } from "react";

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
    label?: string;
    icon?: ReactNode;
    error?: string;
    size?: "sm" | "md" | "lg";
}

const sizeClasses = {
    sm: "py-2 text-sm",
    md: "py-3",
    lg: "py-4",
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
    ({ label, icon, error, size = "md", className = "", ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`w-full ${icon ? "pl-12" : "pl-4"} pr-4 ${sizeClasses[size]} bg-gray-50 border ${error ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-[#4A90E2]"} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white transition-colors ${className}`}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-red-500">{error}</p>
                )}
            </div>
        );
    }
);

FormInput.displayName = "FormInput";
