
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebaseClient";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { Card } from "@/components/Card";
import { IconBox } from "@/components/IconBox";
import { Button } from "@/components/Button";

function VerifyContent() {
    const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
    const [message, setMessage] = useState("Verifying your email...");
    const router = useRouter();
    const searchParams = useSearchParams();
    const auth = getAuth(app);

    useEffect(() => {
        const code = searchParams.get("code");
        if (!code) {
            setStatus("error");
            setMessage("Verification code is missing.");
            return;
        }

        const verify = async () => {
            try {
                // 1. Verify the code via server-side API (updates Firebase Admin)
                const res = await fetch("/api/auth/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Verification failed");
                }

                // 2. Refresh the user's token so the app knows they are verified immediately
                if (auth.currentUser) {
                    await auth.currentUser.reload();
                    await auth.currentUser.getIdToken(true);
                }

                setStatus("success");
                setMessage("Email verified successfully! Redirecting...");

                // 3. Redirect after a short delay
                setTimeout(() => {
                    router.push("/setup");
                }, 1500);

            } catch (error: any) {
                console.error("Verification error:", error);

                // If the code is invalid, check if we might already be verified?
                if (auth.currentUser?.emailVerified) {
                    setStatus("success");
                    setMessage("Email already verified! Redirecting...");
                    setTimeout(() => {
                        router.push("/setup");
                    }, 1500);
                    return;
                }

                setStatus("error");
                if (error.message?.includes("INVALID_OOB_CODE") || error.message?.includes("expired")) {
                    setMessage("This verification link is invalid or has expired.");
                } else {
                    setMessage(error.message || "Failed to verify email.");
                }
            }
        };

        verify();
    }, [auth, searchParams, router]);

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col justify-center px-4">
            <div className="max-w-[428px] w-full mx-auto">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Image src={CartSenseLogo} alt="CartSense" className="h-12 w-auto mx-auto mb-6" />
                </div>

                <Card padding="lg" className="shadow-lg text-center">
                    {status === "verifying" && (
                        <div className="py-8">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying...</h1>
                            <p className="text-gray-500">{message}</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="py-8">
                            <IconBox size="lg" variant="success" className="w-20 h-20 rounded-full mx-auto mb-6">
                                <CheckCircle className="w-10 h-10" />
                            </IconBox>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Success!</h1>
                            <p className="text-gray-500">{message}</p>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="py-8">
                            <IconBox size="lg" variant="error" className="w-20 h-20 rounded-full mx-auto mb-6">
                                <XCircle className="w-10 h-10" />
                            </IconBox>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Verification Failed</h1>
                            <p className="text-gray-500 mb-8">{message}</p>

                            <Button
                                onClick={() => router.push("/verify-email")}
                                fullWidth
                            >
                                Request New Link
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyContent />
        </Suspense>
    )
}
