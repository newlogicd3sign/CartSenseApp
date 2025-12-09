"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, RefreshCw, CheckCircle, LogOut } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { useToast } from "@/components/Toast";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { IconBox } from "@/components/IconBox";

export default function VerifyEmailPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                // Not logged in, redirect to login
                router.push("/login");
                return;
            }

            // If already verified, redirect to setup
            if (firebaseUser.emailVerified) {
                // Update Firestore
                updateDoc(doc(db, "users", firebaseUser.uid), {
                    emailVerified: true,
                }).catch(console.error);

                router.push("/setup");
                return;
            }

            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsub();
    }, [router]);

    const handleResendVerification = async () => {
        if (!user) return;

        setResending(true);

        try {
            await sendEmailVerification(user);
            showToast("Verification email sent! Check your inbox.", "success");
        } catch (error: any) {
            if (error.code === "auth/too-many-requests") {
                showToast("Too many requests. Please wait a few minutes before trying again.", "error");
            } else {
                showToast(error.message || "Failed to send verification email.", "error");
            }
        } finally {
            setResending(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!user) return;

        setChecking(true);

        try {
            // Reload the user to get the latest emailVerified status
            await user.reload();

            // Get the updated user
            const currentUser = auth.currentUser;

            if (currentUser?.emailVerified) {
                // Force token refresh to get updated email_verified claim
                // This is required for Firestore rules to see the verification
                await currentUser.getIdToken(true);

                // Update Firestore
                await updateDoc(doc(db, "users", currentUser.uid), {
                    emailVerified: true,
                });

                showToast("Email verified! Redirecting...", "success");

                setTimeout(() => {
                    router.push("/setup");
                }, 1000);
            } else {
                showToast("Email not verified yet. Please check your inbox and click the verification link.", "error");
            }
        } catch (error: any) {
            showToast(error.message || "Failed to check verification status.", "error");
        } finally {
            setChecking(false);
        }
    };

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/login");
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col">
            {/* Main Content */}
            <div className="flex-1 px-6 pt-12 lg:pt-16">
                <div className="max-w-[428px] mx-auto">
                    {/* Logo & Header */}
                    <div className="text-center mb-8">
                        <Image src={CartSenseLogo} alt="CartSense" className="h-12 w-auto mx-auto mb-6" />
                        <h1 className="text-2xl lg:text-3xl font-medium text-gray-900 mb-2">Verify Your Email</h1>
                        <p className="text-gray-500 text-base">
                            We've sent a verification link to your email
                        </p>
                    </div>

                    {/* Card */}
                    <Card padding="lg" className="shadow-lg">
                        {/* Email Icon */}
                        <IconBox size="lg" variant="primary" className="w-20 h-20 rounded-full mx-auto mb-6">
                            <Mail className="w-10 h-10" />
                        </IconBox>

                        {/* Email Address */}
                        <div className="text-center mb-6">
                            <p className="text-sm text-gray-500 mb-1">Verification email sent to:</p>
                            <p className="font-medium text-gray-900">{user?.email}</p>
                        </div>

                        {/* Instructions */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <p className="text-sm text-gray-600 text-center">
                                Click the link in the email to verify your account.
                                Once verified, click the button below to continue.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {/* Check Verification Button */}
                            <Button
                                onClick={handleCheckVerification}
                                loading={checking}
                                fullWidth
                                size="lg"
                                icon={!checking ? <CheckCircle className="w-5 h-5" /> : undefined}
                                className="rounded-2xl py-4"
                            >
                                {checking ? "Checking..." : "I've Verified My Email"}
                            </Button>

                            {/* Resend Button */}
                            <Button
                                onClick={handleResendVerification}
                                disabled={resending}
                                loading={resending}
                                variant="outline"
                                fullWidth
                                icon={!resending ? <RefreshCw className="w-4 h-4" /> : undefined}
                            >
                                {resending ? "Sending..." : "Resend Verification Email"}
                            </Button>
                        </div>

                        {/* Sign Out Link */}
                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <button
                                onClick={handleSignOut}
                                className="w-full py-3 text-gray-500 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-sm">Sign out and use a different email</span>
                            </button>
                        </div>
                    </Card>

                    {/* Help Text */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-400">
                            Didn't receive the email? Check your spam folder or{" "}
                            <button
                                onClick={handleResendVerification}
                                disabled={resending}
                                className="text-[#4A90E2] hover:underline disabled:opacity-50"
                            >
                                resend it
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
