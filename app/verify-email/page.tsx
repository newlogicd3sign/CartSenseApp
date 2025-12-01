"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, RefreshCw, CheckCircle, AlertCircle, LogOut } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function VerifyEmailPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<"success" | "error">("success");

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
        setMessage(null);

        try {
            await sendEmailVerification(user);
            setMessage("Verification email sent! Check your inbox.");
            setMessageType("success");
        } catch (error: any) {
            if (error.code === "auth/too-many-requests") {
                setMessage("Too many requests. Please wait a few minutes before trying again.");
            } else {
                setMessage(error.message || "Failed to send verification email.");
            }
            setMessageType("error");
        } finally {
            setResending(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!user) return;

        setChecking(true);
        setMessage(null);

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

                setMessage("Email verified! Redirecting...");
                setMessageType("success");

                setTimeout(() => {
                    router.push("/setup");
                }, 1000);
            } else {
                setMessage("Email not verified yet. Please check your inbox and click the verification link.");
                setMessageType("error");
            }
        } catch (error: any) {
            setMessage(error.message || "Failed to check verification status.");
            setMessageType("error");
        } finally {
            setChecking(false);
        }
    };

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/login");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
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
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        {/* Email Icon */}
                        <div className="w-20 h-20 bg-[#4A90E2]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Mail className="w-10 h-10 text-[#4A90E2]" />
                        </div>

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

                        {/* Message */}
                        {message && (
                            <div
                                className={`flex items-start gap-2 p-3 rounded-xl mb-4 ${
                                    messageType === "success"
                                        ? "bg-green-50 border border-green-100"
                                        : "bg-red-50 border border-red-100"
                                }`}
                            >
                                {messageType === "success" ? (
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                )}
                                <p
                                    className={`text-sm ${
                                        messageType === "success" ? "text-green-600" : "text-red-600"
                                    }`}
                                >
                                    {message}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {/* Check Verification Button */}
                            <button
                                onClick={handleCheckVerification}
                                disabled={checking}
                                className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {checking ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Checking...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        <span>I've Verified My Email</span>
                                    </>
                                )}
                            </button>

                            {/* Resend Button */}
                            <button
                                onClick={handleResendVerification}
                                disabled={resending}
                                className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {resending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>Resend Verification Email</span>
                                    </>
                                )}
                            </button>
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
                    </div>

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