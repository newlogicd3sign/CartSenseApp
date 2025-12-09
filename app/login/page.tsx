"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { Card } from "@/components/Card";

export default function LoginPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);

            // Check if email is verified
            if (!cred.user.emailVerified) {
                router.push("/verify-email");
                return;
            }

            sessionStorage.setItem("animateEntry", "true");
            router.push("/prompt");
        } catch (error: any) {
            showToast(error.message || "Login failed", "error");
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
                        <h1 className="text-2xl lg:text-3xl font-medium text-gray-900 mb-2">Welcome back</h1>
                        <p className="text-gray-500 text-base">
                            Sign in to continue your meal planning journey
                        </p>
                    </div>

                    {/* Form Card */}
                    <Card padding="lg" className="shadow-lg">
                        <form onSubmit={handleLogin} className="space-y-4">
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

                            {/* Password Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Password
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-sm text-[#4A90E2] hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white transition-colors"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                disabled={!email.trim() || !password}
                                loading={loading}
                                fullWidth
                                size="lg"
                                icon={!loading ? <ArrowRight className="w-5 h-5" /> : undefined}
                                iconPosition="right"
                                className="rounded-2xl py-4"
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </Button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-sm text-gray-400">or</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Sign Up Link */}
                        <Link
                            href="/signup"
                            className="w-full py-3 bg-white border-2 border-[#4A90E2] text-[#4A90E2] rounded-xl flex items-center justify-center gap-2 hover:bg-[#4A90E2]/5 active:scale-[0.98] transition-all"
                        >
                            <span className="font-medium">Create an Account</span>
                        </Link>
                    </Card>

                    {/* Footer Text */}
                    <p className="text-center text-sm text-gray-400 mt-6 px-4">
                        By signing in, you agree to our{" "}
                        <Link href="/terms" className="text-[#4A90E2] hover:underline">
                            Terms & Conditions
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy-policy" className="text-[#4A90E2] hover:underline">
                            Privacy Policy
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
