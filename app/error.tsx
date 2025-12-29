"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/Button";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Global Error Boundary caught:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Something went wrong!
                </h2>

                <p className="text-gray-500 mb-8">
                    We're sorry, but we encountered an unexpected error. Our team has been notified.
                </p>

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

                    <Link href="/" className="w-full">
                        <Button
                            variant="outline"
                            fullWidth
                            size="lg"
                            icon={<Home className="w-4 h-4" />}
                            className="rounded-xl"
                        >
                            Return Home
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="mt-8 opacity-50">
                <Image
                    src={CartSenseLogo}
                    alt="CartSense"
                    className="h-8 w-auto grayscale"
                />
            </div>
        </div>
    );
}
