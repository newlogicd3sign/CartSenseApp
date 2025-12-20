"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function PrivacyPolicyPage() {
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
                        Privacy Policy
                    </h1>
                    <p className="text-sm text-gray-500 mb-8">Last Updated: November 30, 2025</p>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-gray-600 leading-relaxed mb-6">
                            CartSense ("we," "our," or "us") provides a meal-planning and grocery-assistant service that helps users generate meals, build shopping lists, and connect with third-party grocery services like Kroger. This Privacy Policy explains how we collect, use, store, and share your information when you use the CartSense application and website (the "Service").
                        </p>
                        <p className="text-gray-600 leading-relaxed mb-8">
                            By creating an account or using CartSense, you agree to the practices described in this Privacy Policy.
                        </p>

                        <Section title="1. Information We Collect">
                            <SubSection title="1.1 Information You Provide">
                                <p className="text-gray-600 mb-4">
                                    We may collect the following information when you create an account or use CartSense:
                                </p>

                                <h4 className="font-semibold text-gray-800 mb-2">Account Information</h4>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Name</li>
                                    <li>Email address</li>
                                    <li>Password (securely stored by Firebase; we never see or store your raw password)</li>
                                </ul>

                                <h4 className="font-semibold text-gray-800 mb-2">User Preferences</h4>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Diet type</li>
                                    <li>Food allergies</li>
                                    <li>Sensitivities</li>
                                    <li>Grocery location preferences (e.g., Kroger store ID)</li>
                                </ul>

                                <h4 className="font-semibold text-gray-800 mb-2">Prompts & Meal Data</h4>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Meal prompts you submit</li>
                                    <li>Meals generated for you</li>
                                    <li>Saved meals</li>
                                    <li>Shopping list items you create</li>
                                    <li>Meal selections and replacements</li>
                                </ul>

                                <h4 className="font-semibold text-gray-800 mb-2">Doctor Instruction Uploads (if enabled in the future)</h4>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Photos or documents you upload containing food restrictions</li>
                                    <li>Any text or content extracted from them</li>
                                </ul>
                                <p className="text-gray-500 text-sm italic mb-4">
                                    (This feature is not currently HIPAA-regulated; see Section 8.)
                                </p>
                            </SubSection>

                            <SubSection title="1.2 Automatically Collected Information">
                                <p className="text-gray-600 mb-4">When you use CartSense, we automatically collect:</p>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>IP address</li>
                                    <li>Device information</li>
                                    <li>Browser type</li>
                                    <li>App usage data (pages visited, actions taken)</li>
                                    <li>Error and performance logs</li>
                                </ul>
                                <p className="text-gray-600">This is used to improve app performance and security.</p>
                            </SubSection>

                            <SubSection title="1.3 Third-Party Integrations">
                                <p className="text-gray-600 mb-4">If you connect your Kroger account:</p>
                                <h4 className="font-semibold text-gray-800 mb-2">Kroger API Data</h4>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Your Kroger account ID</li>
                                    <li>Access tokens required for adding items to your Kroger cart</li>
                                    <li>Selected store information</li>
                                    <li>Product data (pricing, aisle, availability)</li>
                                </ul>
                                <p className="text-gray-600 font-medium mb-6">CartSense does not store your Kroger login credentials.</p>

                                <p className="text-gray-600 mb-4">If you use Instacart through CartSense:</p>
                                <h4 className="font-semibold text-gray-800 mb-2">Instacart API Data</h4>
                                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                    <li>Recipe and shopping list information (ingredient names, quantities)</li>
                                    <li>Generated shopping links</li>
                                </ul>
                                <p className="text-gray-600 font-medium">CartSense does not have access to your Instacart account credentials or purchase history. All transactions are completed directly on Instacart's platform.</p>
                            </SubSection>
                        </Section>

                        <Section title="2. How We Use Your Information">
                            <p className="text-gray-600 mb-4">We use your information to:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Generate meals that fit your preferences and allergies</li>
                                <li>Suggest grocery products from Kroger</li>
                                <li>Build and save shopping lists</li>
                                <li>Add items to your Kroger cart when requested</li>
                                <li>Improve accuracy of meal generation</li>
                                <li>Provide customer support</li>
                                <li>Send important service-related notifications</li>
                                <li>Prevent fraud and maintain app security</li>
                            </ul>
                            <p className="text-gray-800 font-semibold">We never sell your personal data.</p>
                        </Section>

                        <Section title="3. How We Use AI (OpenAI)">
                            <p className="text-gray-600 mb-4">When you submit a meal prompt or upload dietary instructions, we may send:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>The text of your prompt</li>
                                <li>Your dietary preferences</li>
                                <li>Food allergies</li>
                                <li>High-level nutritional goals</li>
                                <li>Optional extracted text from doctor instructions (if uploaded)</li>
                            </ul>
                            <p className="text-gray-600 mb-4">We do not send:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Your email</li>
                                <li>Your full profile</li>
                                <li>Payment information</li>
                                <li>Kroger account data</li>
                                <li>Sensitive personal identifiers</li>
                            </ul>
                            <p className="text-gray-600">OpenAI processes this information to generate meal suggestions. Their models do not train on your data.</p>
                        </Section>

                        <Section title="4. How We Store and Protect Your Data">
                            <p className="text-gray-600 mb-4">Your data is stored securely in Firebase/Firestore, protected by:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Encryption at rest and in transit</li>
                                <li>Firebase Authentication security</li>
                                <li>Firestore security rules restricting access to your data only</li>
                                <li>Role-based access controls on our infrastructure</li>
                            </ul>
                            <p className="text-gray-600">We take commercially reasonable measures to prevent unauthorized access.</p>
                        </Section>

                        <Section title="5. Sharing Your Information">
                            <p className="text-gray-600 mb-4">We only share information when necessary to provide the service:</p>

                            <h4 className="font-semibold text-gray-800 mb-2">With Kroger</h4>
                            <p className="text-gray-600 mb-2">To add items to your Kroger cart, we share:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Product IDs</li>
                                <li>Quantities</li>
                                <li>Your authenticated access token</li>
                            </ul>
                            <p className="text-gray-600 mb-4">We do not share personal profile data with Kroger beyond what is required to complete API actions.</p>

                            <h4 className="font-semibold text-gray-800 mb-2">With Instacart</h4>
                            <p className="text-gray-600 mb-2">To generate shopping links, we share:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Ingredient names and quantities</li>
                                <li>Recipe titles and instructions (when applicable)</li>
                            </ul>
                            <p className="text-gray-600 mb-4">We do not share personal profile data, email addresses, or account information with Instacart. All purchases are completed directly on Instacart's platform.</p>

                            <h4 className="font-semibold text-gray-800 mb-2">With OpenAI</h4>
                            <p className="text-gray-600 mb-4">Only prompt-related text is shared (see Section 3).</p>

                            <h4 className="font-semibold text-gray-800 mb-2">With Service Providers</h4>
                            <p className="text-gray-600 mb-2">Such as:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Firebase (authentication + database)</li>
                                <li>Error logging tools</li>
                                <li>Analytics (if enabled later)</li>
                            </ul>
                            <p className="text-gray-600">These providers only access data necessary for their function.</p>
                            <p className="text-gray-800 font-semibold mt-4">We never sell your data to advertisers.</p>
                        </Section>

                        <Section title="6. Your Rights">
                            <p className="text-gray-600 mb-4">Depending on your region, you may have the following rights:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Access your data</li>
                                <li>Correct your information</li>
                                <li>Delete your account</li>
                                <li>Export your data</li>
                                <li>Opt out of analytics or marketing emails</li>
                                <li>Revoke third-party access (e.g., Kroger)</li>
                            </ul>
                            <p className="text-gray-600">
                                You can request deletion anytime by contacting us at:{" "}
                                <a href="mailto:support@cartsense.app" className="text-[#4A90E2] hover:underline">
                                    support@cartsense.app
                                </a>
                            </p>
                        </Section>

                        <Section title="7. Data Retention">
                            <p className="text-gray-600 mb-4">We keep your data only as long as necessary to provide the service.</p>
                            <p className="text-gray-600 mb-2">After account deletion:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>Personal profile data is deleted immediately</li>
                                <li>Shopping lists and saved meals are removed</li>
                                <li>Access tokens for Kroger are revoked</li>
                                <li>Backups may retain encrypted, inaccessible versions for up to 90 days</li>
                            </ul>
                        </Section>

                        <Section title="8. Medical Information Disclaimer">
                            <p className="text-gray-800 font-semibold mb-4">CartSense is not a medical device and is not HIPAA-regulated.</p>
                            <p className="text-gray-600 mb-2">If you upload photos of doctor instructions or enter health-related preferences:</p>
                            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                                <li>These are used solely to filter meal suggestions</li>
                                <li>They are not reviewed by medical professionals</li>
                                <li>You should consult your doctor for medical or dietary decisions</li>
                            </ul>
                        </Section>

                        <Section title="9. Children's Privacy">
                            <p className="text-gray-600 mb-4">CartSense is not intended for children under 13.</p>
                            <p className="text-gray-600">We do not knowingly collect information from children under 13.</p>
                        </Section>

                        <Section title="10. Changes to This Policy">
                            <p className="text-gray-600 mb-4">We may update this Privacy Policy as the app evolves.</p>
                            <p className="text-gray-600">We will notify you of changes through the app or by email.</p>
                        </Section>

                        <Section title="11. Contact">
                            <p className="text-gray-600">
                                If you have questions, contact us at:{" "}
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