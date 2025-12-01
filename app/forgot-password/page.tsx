"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsSuccess(false);
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Check your email for a password reset link.");
            setIsSuccess(true);
        } catch (error: any) {
            // Handle specific Firebase errors
            if (error.code === "auth/user-not-found") {
                setMessage("No account found with this email address.");
            } else if (error.code === "auth/invalid-email") {
                setMessage("Please enter a valid email address.");
            } else if (error.code === "auth/too-many-requests") {
                setMessage("Too many requests. Please try again later.");
            } else {
                setMessage(error.message || "Failed to send reset email.");
            }
            setIsSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col">
            {/* Main Content */}
            <div className="flex-1 px-6 pt-12 lg:pt-16">
                <div className="max-w-[428px] mx-auto">
                    {/* Logo & Header */}
                    <div className="text-center mb-8">
                        <Image src={CartSenseLogo} alt="CartSense" className="h-12 w-auto mx-auto mb-6" />
                        <h1 className="text-2xl lg:text-3xl font-medium text-gray-900 mb-2">Reset Password</h1>
                        <p className="text-gray-500 text-base">
                            Enter your email and we'll send you a reset link
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        {!isSuccess ? (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                {/* Email Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white transition-colors"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Error Message */}
                                {message && !isSuccess && (
                                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-600">{message}</p>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading || !email.trim()}
                                    className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Send Reset Link</span>
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h2 className="text-lg font-medium text-gray-900 mb-2">Check your email</h2>
                                <p className="text-gray-500 text-sm mb-4">
                                    We've sent a password reset link to <span className="font-medium text-gray-700">{email}</span>
                                </p>
                                <p className="text-gray-400 text-xs">
                                    Didn't receive the email? Check your spam folder or{" "}
                                    <button
                                        onClick={() => {
                                            setIsSuccess(false);
                                            setMessage(null);
                                        }}
                                        className="text-[#4A90E2] hover:underline"
                                    >
                                        try again
                                    </button>
                                </p>
                            </div>
                        )}

                        {/* Back to Login Link */}
                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <Link
                                href="/login"
                                className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="font-medium">Back to Sign In</span>
                            </Link>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <p className="text-center text-sm text-gray-400 mt-6 px-4">
                        Remember your password?{" "}
                        <Link href="/login" className="text-[#4A90E2] hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}