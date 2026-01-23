"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/Button";

export default function ShareError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Share page error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Unable to load shared meal
                </h2>

                <p className="text-gray-500 mb-4">
                    This shared meal link may have expired or there was an error loading it.
                </p>

                {process.env.NODE_ENV === "development" && (
                    <p className="text-xs text-red-500 bg-red-50 p-3 rounded-lg mb-4 text-left font-mono">
                        {error.message}
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    <Button
                        onClick={() => reset()}
                        fullWidth
                        size="lg"
                        icon={<RefreshCw className="w-4 h-4" />}
                        className="rounded-xl"
                    >
                        Try again
                    </Button>

                    <Link href="/login" className="w-full">
                        <Button
                            variant="outline"
                            fullWidth
                            size="lg"
                            icon={<Home className="w-4 h-4" />}
                            className="rounded-xl"
                        >
                            Go to Login
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
