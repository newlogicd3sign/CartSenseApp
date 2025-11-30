"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsSuccess(false);
        setLoading(true);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            // Create a Firestore user doc
            await setDoc(doc(db, "users", cred.user.uid), {
                email,
                planType: "free",
                monthlyPromptCount: 0,
                promptPeriodStart: serverTimestamp(),
                createdAt: serverTimestamp(),
            });

            setMessage("Account created successfully!");
            setIsSuccess(true);

            // Redirect to setup after short delay
            setTimeout(() => {
                router.push("/setup");
            }, 1000);
        } catch (error: any) {
            setMessage(error.message || "Something went wrong");
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
                        <h1 className="text-2xl lg:text-3xl font-medium text-gray-900 mb-2">Create Account</h1>
                        <p className="text-gray-500 text-base">
                            Start your personalized meal planning journey
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <form onSubmit={handleSignup} className="space-y-4">
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

                            {/* Password Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Create a password"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white transition-colors"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                                    Must be at least 6 characters
                                </p>
                            </div>

                            {/* Terms Checkbox */}
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-[#4A90E2] focus:ring-[#4A90E2] cursor-pointer"
                                />
                                <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer">
                                    I agree to the{" "}
                                    <Link href="/terms" className="text-[#4A90E2] hover:underline">
                                        Terms & Conditions
                                    </Link>{" "}
                                    and{" "}
                                    <Link href="/privacy-policy" className="text-[#4A90E2] hover:underline">
                                        Privacy Policy
                                    </Link>
                                </label>
                            </div>

                            {/* Message */}
                            {message && (
                                <div
                                    className={`flex items-start gap-2 p-3 rounded-xl ${
                                        isSuccess
                                            ? "bg-green-50 border border-green-100"
                                            : "bg-red-50 border border-red-100"
                                    }`}
                                >
                                    {isSuccess ? (
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    )}
                                    <p
                                        className={`text-sm ${
                                            isSuccess ? "text-green-600" : "text-red-600"
                                        }`}
                                    >
                                        {message}
                                    </p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || !agreedToTerms}
                                className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Creating account...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Create Account</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-sm text-gray-400">or</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Sign In Link */}
                        <Link
                            href="/login"
                            className="w-full py-3 bg-white border-2 border-[#4A90E2] text-[#4A90E2] rounded-xl flex items-center justify-center gap-2 hover:bg-[#4A90E2]/5 active:scale-[0.98] transition-all"
                        >
                            <span className="font-medium">Already have an account? Sign In</span>
                        </Link>
                    </div>

                    {/* Features List */}
                    <div className="mt-6 px-2">
                        <p className="text-sm font-medium text-gray-700 mb-3">What you'll get:</p>
                        <ul className="space-y-2">
                            {[
                                "AI-powered personalized meal suggestions",
                                "Smart grocery lists with Kroger integration",
                                "Doctor's diet instructions support",
                                "Save and organize your favorite meals",
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                                    <CheckCircle className="w-4 h-4 text-[#10b981] flex-shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Footer Text */}
                    <p className="text-center text-sm text-gray-400 mt-6 px-4 pb-6">
                        Read our{" "}
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