"use client";

import { X, Sparkles, MessageSquare, Camera, Bookmark, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

type FeatureType = "meal_chat" | "diet_photo" | "saved_meals" | "shopping_lists";
type VariantType = "modal" | "inline" | "full_page";

type UpgradePromptProps = {
    feature: FeatureType;
    onClose?: () => void;
    variant?: VariantType;
};

const featureConfig: Record<FeatureType, {
    title: string;
    description: string;
    icon: typeof MessageSquare;
    benefit: string;
}> = {
    meal_chat: {
        title: "Unlock Unlimited Meal Customization",
        description: "You've used all 6 free chat messages this month.",
        icon: MessageSquare,
        benefit: "Premium users get unlimited AI chat messages",
    },
    diet_photo: {
        title: "Unlock Diet Instructions",
        description: "Upload and apply diet restrictions to filter meal suggestions.",
        icon: Camera,
        benefit: "Premium users can upload diet instructions from photos",
    },
    saved_meals: {
        title: "Save More Meals",
        description: "You've reached the free tier limit of 4 saved meals.",
        icon: Bookmark,
        benefit: "Premium users get unlimited saved meals",
    },
    shopping_lists: {
        title: "More Shopping Flexibility",
        description: "You've reached the free tier limit of 2 shopping sessions.",
        icon: ShoppingCart,
        benefit: "Premium users get unlimited shopping lists",
    },
};

export function UpgradePrompt({ feature, onClose, variant = "modal" }: UpgradePromptProps) {
    const router = useRouter();
    const config = featureConfig[feature];
    const Icon = config.icon;

    const handleUpgrade = () => {
        router.push("/upgrade");
    };

    if (variant === "inline") {
        return (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-violet-100 rounded-lg">
                        <Icon className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{config.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                        <button
                            onClick={handleUpgrade}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            Upgrade to Premium
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (variant === "full_page") {
        return (
            <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center">
                    <div className="inline-flex p-4 bg-violet-100 rounded-full mb-6">
                        <Icon className="w-12 h-12 text-violet-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">{config.title}</h1>
                    <p className="text-gray-600 mb-2">{config.description}</p>
                    <p className="text-sm text-violet-600 font-medium mb-8">{config.benefit}</p>
                    <button
                        onClick={handleUpgrade}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200"
                    >
                        <Sparkles className="w-5 h-5" />
                        Upgrade to Premium
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
                        >
                            Go back
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Modal variant (default)
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                    <div className="text-center">
                        <div className="inline-flex p-3 bg-violet-100 rounded-full mb-4">
                            <Icon className="w-8 h-8 text-violet-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">{config.title}</h2>
                        <p className="text-gray-600 mb-2">{config.description}</p>
                        <p className="text-sm text-violet-600 font-medium mb-6">{config.benefit}</p>
                        <button
                            onClick={handleUpgrade}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                        >
                            <Sparkles className="w-5 h-5" />
                            Upgrade to Premium
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="mt-3 w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
                            >
                                Maybe later
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}