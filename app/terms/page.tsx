"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link
                        href="/login"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Link>
                    <Image src={CartSenseLogo} alt="CartSense" className="h-8 w-auto" />
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                        Terms & Conditions
                    </h1>
                    <p className="text-sm text-gray-500 mb-8">Last Updated: November 30, 2025</p>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-gray-600 leading-relaxed mb-6">
                            Welcome to CartSense ("we," "our," or "us"). These Terms & Conditions ("Terms") govern your use of the CartSense application, website, and related services (the "Service"). By creating an account or using the Service, you agree to be bound by these Terms.
                        </p>
                        <p className="text-gray-600 leading-relaxed mb-8 font-medium">
                            If you do not agree, please do not use CartSense.
                        </p>

                        <Section title="1. Overview of the Service">
                            <p className="text-gray-600 mb-4">CartSense provides:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>AI-powered meal suggestions</li>
                                <li>Grocery ingredient mapping (via Kroger API)</li>
                                <li>Shopping list management</li>
                                <li>Options to add items to your Kroger cart</li>
                                <li>Meal preference filtering (diet, allergies, sensitivities)</li>
                                <li>Saved meals and prompt history</li>
                                <li>Optional paid subscription features</li>
                            </ul>
                            <p className="text-gray-800 font-semibold">CartSense is not a medical service and does not provide medical advice (see Section 9).</p>
                        </Section>

                        <Section title="2. Eligibility">
                            <p className="text-gray-600 mb-4">To use CartSense, you must:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Be at least 13 years old</li>
                                <li>Create an account with accurate information</li>
                                <li>Comply with all applicable laws when using the Service</li>
                            </ul>
                            <p className="text-gray-600">If you connect a Kroger account, you must also comply with Kroger's policies.</p>
                        </Section>

                        <Section title="3. Accounts & Security">
                            <SubSection title="3.1 Account Creation">
                                <p className="text-gray-600 mb-4">
                                    You must create an account using a valid email address and password.
                                    Passwords are securely handled through Firebase Authentication; we do not store plain-text passwords.
                                </p>
                            </SubSection>

                            <SubSection title="3.2 Your Responsibility">
                                <p className="text-gray-600 mb-2">You are responsible for:</p>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Maintaining the security of your account</li>
                                    <li>Any activity that occurs under your account</li>
                                    <li>Immediately notifying us of unauthorized access</li>
                                </ul>
                            </SubSection>

                            <SubSection title="3.3 Account Suspension">
                                <p className="text-gray-600 mb-2">We may suspend or terminate your account if:</p>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>You violate these Terms</li>
                                    <li>You misuse the Service</li>
                                    <li>You engage in fraudulent, abusive, or harmful behavior</li>
                                </ul>
                            </SubSection>
                        </Section>

                        <Section title="4. Use of the Service">
                            <p className="text-gray-600 mb-4">You agree not to:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Misuse or attempt to exploit model outputs</li>
                                <li>Reverse-engineer or scrape our data</li>
                                <li>Attempt unauthorized access to Firestore, Firebase, or infrastructure</li>
                                <li>Send harmful, violent, hateful, or sexual content in prompts</li>
                                <li>Use the Service for unlawful purposes</li>
                                <li>Violate Kroger's API guidelines</li>
                            </ul>
                            <p className="text-gray-600">We may restrict prompt content to maintain platform safety.</p>
                        </Section>

                        <Section title="5. AI-Generated Content">
                            <p className="text-gray-600 mb-4">
                                CartSense uses OpenAI to generate meal ideas based on your preferences and inputs.
                            </p>
                            <h4 className="font-semibold text-gray-800 mb-2">Important Notes:</h4>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>AI-generated meal suggestions may be inaccurate or incomplete</li>
                                <li>Ingredients or prices from Kroger may vary</li>
                                <li>AI outputs should be reviewed before use</li>
                                <li>We do not guarantee nutritional accuracy</li>
                            </ul>
                            <p className="text-gray-600">By using CartSense, you agree that AI-generated content is provided "as-is" without warranty.</p>
                        </Section>

                        <Section title="6. Third-Party Services">
                            <SubSection title="6.1 Kroger Integration">
                                <p className="text-gray-600 mb-2">CartSense allows you to:</p>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Select a Kroger store</li>
                                    <li>View product details (name, price, aisle, availability)</li>
                                    <li>Add items directly to your Kroger cart</li>
                                </ul>
                                <p className="text-gray-600 mb-2">Kroger integrations require you to:</p>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Authenticate with Kroger</li>
                                    <li>Comply with Kroger's terms</li>
                                    <li>Understand that CartSense is not affiliated with Kroger</li>
                                </ul>
                                <p className="text-gray-600">We do not control Kroger's data, pricing, outages, or cart behavior.</p>
                            </SubSection>

                            <SubSection title="6.2 OpenAI">
                                <p className="text-gray-600 mb-4">
                                    OpenAI processes your prompts to provide meal suggestions.
                                    We do not send your personal profile information to OpenAI beyond what is needed for meal generation.
                                </p>
                            </SubSection>

                            <SubSection title="6.3 Firebase">
                                <p className="text-gray-600">Used for authentication, storage, analytics, and security.</p>
                            </SubSection>
                        </Section>

                        <Section title="7. Payment & Subscription Terms">
                            <p className="text-gray-600 mb-4">If CartSense offers paid plans (e.g., unlimited prompts):</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Fees are billed through the platform specified at purchase</li>
                                <li>Subscriptions auto-renew unless canceled</li>
                                <li>You may cancel at any time</li>
                                <li>No refunds are provided for partial periods</li>
                                <li>Prices may change with reasonable notice</li>
                            </ul>
                            <p className="text-gray-600">If a payment fails, access to premium features may be suspended.</p>
                        </Section>

                        <Section title="8. User Content">
                            <p className="text-gray-600 mb-4">You may upload or enter:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Meal prompts</li>
                                <li>Preferences</li>
                                <li>Shopping list items</li>
                                <li>Photos of dietary instructions (optional future feature)</li>
                            </ul>
                            <p className="text-gray-600 mb-4">
                                By using the Service, you grant CartSense a limited license to process this content solely to provide the functionality of the Service.
                            </p>
                            <p className="text-gray-800 font-semibold">You retain ownership of your content.</p>
                        </Section>

                        <Section title="9. No Medical Advice">
                            <p className="text-gray-800 font-semibold mb-4">CartSense is not a medical service.</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Meal suggestions may not meet your specific medical or dietary needs</li>
                                <li>CartSense does not replace a nutritionist or doctor</li>
                                <li>Any restrictions based on health conditions should be verified with a medical professional</li>
                            </ul>
                            <p className="text-gray-600">You agree not to rely on CartSense for medical, diagnosis, or treatment purposes.</p>
                        </Section>

                        <Section title="10. Limitation of Liability">
                            <p className="text-gray-600 mb-4">To the fullest extent allowed by law:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>CartSense is provided on an "as-is" and "as-available" basis</li>
                                <li>We are not liable for inaccuracies in meals, ingredients, nutrition, or Kroger data</li>
                                <li>We are not responsible for outages or errors from Kroger or OpenAI</li>
                                <li>We do not guarantee uninterrupted service</li>
                                <li>We are not responsible for damages arising from user misuse or incorrect dietary choices</li>
                            </ul>
                            <p className="text-gray-600">Your sole remedy for dissatisfaction with the Service is to stop using it.</p>
                        </Section>

                        <Section title="11. Indemnification">
                            <p className="text-gray-600 mb-4">
                                You agree to indemnify and hold harmless CartSense and its creators from any claims, damages, losses, or liabilities arising from:
                            </p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Your use of the Service</li>
                                <li>Your violation of these Terms</li>
                                <li>Your interaction with third-party services</li>
                            </ul>
                        </Section>

                        <Section title="12. Termination">
                            <p className="text-gray-600 mb-4">You may delete your account at any time.</p>
                            <p className="text-gray-600 mb-4">
                                We may terminate or suspend access if you violate these Terms or misuse the Service.
                            </p>
                            <p className="text-gray-600 mb-2">Upon termination:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Your account and stored data will be deleted</li>
                                <li>Third-party tokens (e.g., Kroger) will be revoked</li>
                                <li>Certain anonymized logs may be retained for security and analytics</li>
                            </ul>
                        </Section>

                        <Section title="13. Changes to Terms">
                            <p className="text-gray-600 mb-4">We may update these Terms at any time.</p>
                            <p className="text-gray-600">
                                Changes will be posted within the app or emailed to you.
                                Continued use of the Service constitutes acceptance of updated Terms.
                            </p>
                        </Section>

                        <Section title="14. Governing Law">
                            <p className="text-gray-600 mb-4">
                                These Terms are governed by the laws of the State of Nevada.
                            </p>
                            <p className="text-gray-600">
                                Any disputes will be resolved in state or federal courts within that jurisdiction.
                            </p>
                        </Section>

                        <Section title="15. Contact">
                            <p className="text-gray-600">
                                For questions about these Terms:{" "}
                                <a href="mailto:support@cartsense.app" className="text-[#4A90E2] hover:underline">
                                    support@cartsense.app
                                </a>
                            </p>
                        </Section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
            {children}
        </div>
    );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">{title}</h3>
            {children}
        </div>
    );
}