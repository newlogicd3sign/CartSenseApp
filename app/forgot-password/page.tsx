"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowRight, CheckCircle, ArrowLeft } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { Card } from "@/components/Card";
import { IconBox } from "@/components/IconBox";

export default function ForgotPasswordPage() {
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setIsSuccess(true);
        } catch (error: any) {
            // Handle specific Firebase errors
            if (error.code === "auth/user-not-found") {
                showToast("No account found with this email address.", "error");
            } else if (error.code === "auth/invalid-email") {
                showToast("Please enter a valid email address.", "error");
            } else if (error.code === "auth/too-many-requests") {
                showToast("Too many requests. Please try again later.", "error");
            } else {
                showToast(error.message || "Failed to send reset email.", "error");
            }
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
                    <Card padding="lg" className="shadow-lg">
                        {!isSuccess ? (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                {/* Email Input */}
                                <FormInput
                                    type="email"
                                    label="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    icon={<Mail className="w-5 h-5" />}
                                    required
                                />

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    disabled={!email.trim()}
                                    loading={loading}
                                    fullWidth
                                    size="lg"
                                    icon={!loading ? <ArrowRight className="w-5 h-5" /> : undefined}
                                    iconPosition="right"
                                    className="rounded-2xl py-4"
                                >
                                    {loading ? "Sending..." : "Send Reset Link"}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <IconBox size="lg" variant="success" className="mx-auto mb-4 w-16 h-16 rounded-full">
                                    <CheckCircle className="w-8 h-8" />
                                </IconBox>
                                <h2 className="text-lg font-medium text-gray-900 mb-2">Check your email</h2>
                                <p className="text-gray-500 text-sm mb-4">
                                    We've sent a password reset link to <span className="font-medium text-gray-700">{email}</span>
                                </p>
                                <p className="text-gray-400 text-xs">
                                    Didn't receive the email? Check your spam folder or{" "}
                                    <button
                                        onClick={() => setIsSuccess(false)}
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
                    </Card>

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
