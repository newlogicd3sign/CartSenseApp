"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ArrowRight, CheckCircle, Eye, EyeOff } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { Card } from "@/components/Card";

export default function SignupPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showTermsReminder, setShowTermsReminder] = useState(false);

    // Password validation
    const passwordRules = {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
    };
    const isPasswordValid = Object.values(passwordRules).every(Boolean);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            // Send email verification
            await sendEmailVerification(cred.user);

            // Create a Firestore user doc
            await setDoc(doc(db, "users", cred.user.uid), {
                email,
                planType: "free",
                monthlyPromptCount: 0,
                promptPeriodStart: serverTimestamp(),
                createdAt: serverTimestamp(),
                emailVerified: false,
            });

            showToast("Account created! Check your email to verify.", "success");

            // Redirect to verification page after short delay
            setTimeout(() => {
                router.push("/verify-email");
            }, 1000);
        } catch (error: any) {
            showToast(error.message || "Something went wrong", "error");
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
                    <Card padding="lg" className="shadow-lg">
                        <form onSubmit={handleSignup} className="space-y-4">
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
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Create a password"
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
                                {/* Password Requirements */}
                                <div className="mt-3 p-4 bg-gray-50 border border-gray-300 rounded-xl">
                                    <p className="text-xs font-medium text-gray-600 mb-3">Password must contain:</p>
                                    <div className="space-y-2">
                                        <div className={`flex items-center gap-2.5 text-sm ${passwordRules.minLength ? 'text-emerald-600' : 'text-gray-600'}`}>
                                            {passwordRules.minLength ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                                            )}
                                            <span>At least 8 characters</span>
                                        </div>
                                        <div className={`flex items-center gap-2.5 text-sm ${passwordRules.hasUppercase ? 'text-emerald-600' : 'text-gray-600'}`}>
                                            {passwordRules.hasUppercase ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                                            )}
                                            <span>One uppercase letter</span>
                                        </div>
                                        <div className={`flex items-center gap-2.5 text-sm ${passwordRules.hasLowercase ? 'text-emerald-600' : 'text-gray-600'}`}>
                                            {passwordRules.hasLowercase ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                                            )}
                                            <span>One lowercase letter</span>
                                        </div>
                                        <div className={`flex items-center gap-2.5 text-sm ${passwordRules.hasNumber ? 'text-emerald-600' : 'text-gray-600'}`}>
                                            {passwordRules.hasNumber ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                                            )}
                                            <span>One number</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Terms Checkbox */}
                            <div>
                                <div className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${showTermsReminder && !agreedToTerms ? 'bg-amber-50 border border-amber-200' : ''}`}>
                                    <input
                                        type="checkbox"
                                        id="terms"
                                        checked={agreedToTerms}
                                        onChange={(e) => {
                                            setAgreedToTerms(e.target.checked);
                                            if (e.target.checked) setShowTermsReminder(false);
                                        }}
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
                                {showTermsReminder && !agreedToTerms && (
                                    <p className="text-sm text-amber-600 mt-2 ml-1">
                                        Please agree to the Terms & Conditions to continue
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div
                                onClick={() => {
                                    if (!agreedToTerms && isPasswordValid && !loading) {
                                        setShowTermsReminder(true);
                                    }
                                }}
                            >
                                <Button
                                    type="submit"
                                    disabled={!agreedToTerms || !isPasswordValid}
                                    loading={loading}
                                    fullWidth
                                    size="lg"
                                    icon={!loading ? <ArrowRight className="w-5 h-5" /> : undefined}
                                    iconPosition="right"
                                    className="rounded-2xl py-4"
                                >
                                    {loading ? "Creating account..." : "Create Account"}
                                </Button>
                            </div>
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
                    </Card>

                    {/* Features List */}
                    <div className="mt-6 px-2">
                        <p className="text-sm font-medium text-gray-700 mb-3">What you'll get:</p>
                        <ul className="space-y-2">
                            {[
                                "AI-powered personalized meal suggestions",
                                "Smart grocery lists with Kroger integration",
                                "Diet instructions support",
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
