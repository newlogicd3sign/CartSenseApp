import { notFound } from "next/navigation"; // 16.0.7 import
import { adminDb } from "@/lib/firebaseAdmin";
import { MealCard } from "@/components/MealCard";
import { Button } from "@/components/Button";
import Link from "next/link";
import { Check, ClipboardList, Utensils, ShoppingCart, ArrowRight } from "lucide-react";
import { getCompliantDiets } from "@/lib/sensitivityMapping";

// Force dynamic rendering to ensure fresh data
export const dynamic = "force-dynamic";

import { Metadata } from "next";

async function getSharedMeal(shareId: string) {
    try {
        console.log("[Share] Fetching shared meal:", shareId);
        const docSnap = await adminDb.collection("sharedMeals").doc(shareId).get();
        console.log("[Share] Doc exists:", docSnap.exists);
        if (!docSnap.exists) return null;
        const data = docSnap.data();
        console.log("[Share] Doc data keys:", data ? Object.keys(data) : "no data");
        return { id: docSnap.id, ...data };
    } catch (e) {
        console.error("[Share] Error fetching shared meal:", e);
        // Re-throw so we can see the actual error
        throw e;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
    const { shareId } = await params;
    const sharedDoc = await getSharedMeal(shareId);

    if (!sharedDoc) {
        return {
            title: 'Meal Not Found - CartSense',
        };
    }

    const { mealData } = sharedDoc as any;

    return {
        title: `${mealData.name} - Shared on CartSense`,
        description: mealData.description || `Check out this meal: ${mealData.name}. Get the ingredients and recipe automatically with CartSense.`,
        openGraph: {
            title: mealData.name,
            description: mealData.description || `Check out this meal on CartSense.`,
            images: mealData.imageUrl ? [{ url: mealData.imageUrl }] : [],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: mealData.name,
            description: mealData.description || `Check out this meal on CartSense.`,
            images: mealData.imageUrl ? [mealData.imageUrl] : [],
        },
    };
}

export default async function SharedMealPage({ params }: { params: Promise<{ shareId: string }> }) {
    const { shareId } = await params;
    const sharedDoc = await getSharedMeal(shareId);

    if (!sharedDoc) {
        return notFound();
    }

    const { mealData, sharerId } = sharedDoc as any;

    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col">
            {/* Header / Nav */}
            <div className="bg-white border-b border-gray-100 py-4 px-6 md:px-8 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    {/* Simplified Logo */}
                    <div className="w-8 h-8 bg-[#4A90E2] rounded-lg flex items-center justify-center">
                        <Utensils className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-[#4A90E2] to-[#6366f1] bg-clip-text text-transparent">
                        CartSense
                    </span>
                </div>
                <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    Log in
                </Link>
            </div>

            <main className="flex-grow">
                <div className="max-w-7xl mx-auto px-6 py-10 md:py-16">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start">

                        {/* Left Column: Meal Preview */}
                        <div className="order-2 lg:order-1 relative">
                            {/* Decorative Background Blob */}
                            <div className="absolute -top-10 -left-10 w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl -z-10 blur-3xl opacity-60"></div>

                            <div className="bg-white p-6 rounded-3xl shadow-xl ring-1 ring-gray-100 transform rotate-1 lg:hover:rotate-0 transition-transform duration-500">
                                <div className="mb-4 flex items-center gap-3">
                                    <span className="px-3 py-1 bg-blue-50 text-[#4A90E2] text-xs font-bold uppercase rounded-full tracking-wide">
                                        Shared with you
                                    </span>
                                </div>
                                <MealCard
                                    id="preview"
                                    {...mealData}
                                    dietBadges={getCompliantDiets(mealData.ingredients)}
                                    // Disable interactions for preview
                                    onClick={() => { }}
                                    actionButton={null}
                                />
                                <div className="mt-4 p-4 bg-gray-50 rounded-2xl flex items-start gap-3">
                                    <ClipboardList className="w-5 h-5 text-gray-400 mt-1" />
                                    <div>
                                        <h4 className="font-medium text-gray-900 text-sm">Includes Shopping List</h4>
                                        <p className="text-gray-500 text-xs mt-1">
                                            {mealData.ingredients.length} ingredients ready to add to your grocery cart.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: CTA & Copy */}
                        <div className="order-1 lg:order-2 lg:pt-8">
                            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
                                "{mealData.name}"<br />
                                <span className="text-gray-400 font-medium text-2xl md:text-3xl block mt-2">was shared with you.</span>
                            </h1>

                            <div className="prose prose-lg text-gray-600 mb-10">
                                <p>
                                    To view the full meal, ingredients, and grocery items, you’ll need a free CartSense account.
                                </p>
                                <p>
                                    If you’re new, we’ll walk you through a quick setup to personalize your meals and connect your store.
                                    Once setup is complete, <strong>this meal will be saved to your Saved Meals automatically.</strong>
                                </p>
                            </div>

                            <ul className="space-y-4 mb-10">
                                <li className="flex items-center gap-3 text-gray-700 font-medium">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                    Guided setup (takes just a minute)
                                </li>
                                <li className="flex items-center gap-3 text-gray-700 font-medium">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                    Meal saved automatically
                                </li>
                                <li className="flex items-center gap-3 text-gray-700 font-medium">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                    No credit card required
                                </li>
                            </ul>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    href={`/signup?ref=share&shareId=${shareId}`}
                                    className="flex w-full sm:w-auto"
                                >
                                    <Button
                                        size="lg"
                                        className="w-full shadow-lg shadow-blue-500/20 py-4 text-lg"
                                        icon={<ArrowRight className="w-5 h-5" />}
                                        iconPosition="right"
                                    >
                                        Get Started
                                    </Button>
                                </Link>

                                <Link
                                    href={`/login?ref=share&shareId=${shareId}`}
                                    className="flex w-full sm:w-auto"
                                >
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="w-full py-4 text-lg"
                                    >
                                        I have an account
                                    </Button>
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            <footer className="py-8 text-center text-sm text-gray-400">
                &copy; {new Date().getFullYear()} CartSense. All rights reserved.
            </footer>
        </div>
    );
}
