"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
    id: string;
    message: string;
    type: ToastType;
};

type ToastContextType = {
    showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, 2000);

        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    const bgColor = {
        success: "bg-emerald-50 border-emerald-200",
        error: "bg-red-50 border-red-200",
        info: "bg-blue-50 border-blue-200",
    }[toast.type];

    const textColor = {
        success: "text-emerald-800",
        error: "text-red-800",
        info: "text-blue-800",
    }[toast.type];

    const Icon = {
        success: CheckCircle,
        error: AlertCircle,
        info: Info,
    }[toast.type];

    const iconColor = {
        success: "text-emerald-500",
        error: "text-red-500",
        info: "text-blue-500",
    }[toast.type];

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm ${bgColor} ${isExiting ? "animate-toast-exit" : "animate-toast-enter"
                }`}
        >
            <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
            <p className={`text-sm font-medium flex-1 ${textColor}`}>{toast.message}</p>
            <button
                onClick={handleClose}
                className={`p-1 rounded-full hover:bg-black/5 transition-colors ${textColor}`}
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-md pointer-events-none">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onRemove={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}