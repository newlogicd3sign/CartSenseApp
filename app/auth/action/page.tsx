"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import Image from "next/image";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { IconBox } from "@/components/IconBox";

export default function AuthActionPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const handleAction = async () => {
            const mode = searchParams.get("mode");
            const oobCode = searchParams.get("oobCode");

            if (!oobCode) {
                setStatus("error");
                setErrorMessage("Invalid verification link. Please request a new one.");
                return;
            }

            try {
                if (mode === "verifyEmail") {
                    // Check the action code first to get user info
                    const actionCodeInfo = await checkActionCode(auth, oobCode);

                    // Apply the action code to verify the email
                    await applyActionCode(auth, oobCode);

                    // If user is signed in, update their token and Firestore
                    if (auth.currentUser) {
                        await auth.currentUser.reload();
                        await auth.currentUser.getIdToken(true);

                        await setDoc(doc(db, "users", auth.currentUser.uid), {
                            emailVerified: true,
                        }, { merge: true });
                    }

                    setStatus("success");

                    // Auto-redirect after showing success
                    setTimeout(() => {
                        if (auth.currentUser) {
                            router.push("/setup");
                        } else {
                            router.push("/login");
                        }
                    }, 2000);
                } else if (mode === "resetPassword") {
                    // Redirect to password reset page with the code
                    router.push(`/reset-password?oobCode=${oobCode}`);
                } else {
                    setStatus("error");
                    setErrorMessage("Unknown action type.");
                }
            } catch (error: any) {
                setStatus("error");
                if (error.code === "auth/invalid-action-code") {
                    setErrorMessage("This verification link has expired or already been used. Please request a new one.");
                } else if (error.code === "auth/expired-action-code") {
                    setErrorMessage("This verification link has expired. Please request a new one.");
                } else {
                    setErrorMessage(error.message || "Something went wrong. Please try again.");
                }
            }
        };

        handleAction();
    }, [searchParams, router]);

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col">
            <div className="flex-1 px-6 pt-12 lg:pt-16">
                <div className="max-w-[428px] mx-auto">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <Image src={CartSenseLogo} alt="CartSense" className="h-12 w-auto mx-auto mb-6" />
                    </div>

                    <Card padding="lg" className="shadow-lg">
                        {status === "loading" && (
                            <div className="text-center py-8">
                                <IconBox size="lg" variant="primary" className="w-20 h-20 rounded-full mx-auto mb-6">
                                    <Loader2 className="w-10 h-10 animate-spin" />
                                </IconBox>
                                <h1 className="text-xl font-medium text-gray-900 mb-2">
                                    Verifying your email...
                                </h1>
                                <p className="text-gray-500">Please wait a moment.</p>
                            </div>
                        )}

                        {status === "success" && (
                            <div className="text-center py-8">
                                <IconBox size="lg" variant="success" className="w-20 h-20 rounded-full mx-auto mb-6">
                                    <CheckCircle className="w-10 h-10" />
                                </IconBox>
                                <h1 className="text-xl font-medium text-gray-900 mb-2">
                                    Email Verified!
                                </h1>
                                <p className="text-gray-500 mb-6">
                                    Your email has been successfully verified. Redirecting you now...
                                </p>
                                <Button
                                    onClick={() => router.push(auth.currentUser ? "/setup" : "/login")}
                                    fullWidth
                                >
                                    Continue to App
                                </Button>
                            </div>
                        )}

                        {status === "error" && (
                            <div className="text-center py-8">
                                <IconBox size="lg" variant="error" className="w-20 h-20 rounded-full mx-auto mb-6">
                                    <XCircle className="w-10 h-10" />
                                </IconBox>
                                <h1 className="text-xl font-medium text-gray-900 mb-2">
                                    Verification Failed
                                </h1>
                                <p className="text-gray-500 mb-6">{errorMessage}</p>
                                <div className="space-y-3">
                                    <Button
                                        onClick={() => router.push("/verify-email")}
                                        fullWidth
                                    >
                                        Request New Link
                                    </Button>
                                    <Button
                                        onClick={() => router.push("/login")}
                                        variant="outline"
                                        fullWidth
                                    >
                                        Back to Login
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
