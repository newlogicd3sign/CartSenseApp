"use client";

import { useState } from "react";
// import { Dialog } from "@/components/Dialog";
import { X, Copy, Check, Facebook, Mail, Link as LinkIcon, Share2, Twitter } from "lucide-react";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { LoadingSpinner } from "./LoadingSpinner";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    meal: {
        id: string;
        name: string;
        description: string;
        mealType: string;
        ingredients: any[];
        steps: string[];
        macros?: any;
        imageUrl?: string;
        servings?: number;
        cookTimeRange?: any;
    };
    userId: string;
}

export function ShareModal({ isOpen, onClose, meal, userId }: ShareModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const generateLink = async () => {
        if (shareUrl) return; // Already generated

        setLoading(true);
        try {
            const res = await fetch("/api/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meal, userId }),
            });

            if (!res.ok) throw new Error("Failed to generate link");

            const data = await res.json();
            // Construct full URL. Window.location.origin is reliable in client.
            const fullUrl = `${window.location.origin}/share/${data.shareId}`;
            setShareUrl(fullUrl);

        } catch (error) {
            console.error(error);
            showToast("Failed to create share link.", "error");
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate link when modal opens if not already done?
    // Or wait for users action? Let's check props.
    // Effect: if Open and no URL, generate it.
    // For now we can do it on mount if isOpen
    // Better UX: Show "Generating link..." skeleton then the UI.

    if (isOpen && !shareUrl && !loading) {
        generateLink();
    }

    const handleCopy = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        showToast("Link copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFacebook = () => {
        if (!shareUrl) return;
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        window.open(fbUrl, "_blank", "width=600,height=400");
    };

    const handleTwitter = () => {
        if (!shareUrl) return;
        const text = encodeURIComponent(`Check out "${meal.name}" on CartSense!`);
        const url = encodeURIComponent(shareUrl);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "width=600,height=400");
    };

    const handleEmail = () => {
        if (!shareUrl) return;
        const subject = encodeURIComponent("I saved this meal in CartSense — thought you’d like it");
        const body = encodeURIComponent(`I saved this meal in CartSense and wanted to share it with you.\n\nCartSense helps you plan meals and add ingredients directly to your grocery cart.\n\nClick the link below to view the meal:\n${shareUrl}\n\nIf you’re new to CartSense, you’ll be guided through a quick setup to personalize your experience. Once you’re done, this meal will be saved to your account automatically.\n\n👉 View the meal in CartSense`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-[#4A90E2]" />
                        Share Meal
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <LoadingSpinner size="lg" className="text-[#4A90E2]" />
                            <p className="mt-4 text-gray-500 font-medium">Creating public link...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <p className="text-gray-600 text-sm">
                                Share <strong>"{meal.name}"</strong> with friends. They can view it and save it to their own account instantly.
                            </p>

                            {/* Link Input */}
                            <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                                <LinkIcon className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                                <input
                                    readOnly
                                    value={shareUrl || ""}
                                    className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-600 truncate"
                                    onClick={(e) => e.currentTarget.select()}
                                />
                                <Button
                                    size="sm"
                                    variant={copied ? "primary" : "secondary"} // Use valid variants
                                    onClick={handleCopy}
                                    className={copied ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : ""}
                                >
                                    {copied ? "Copied" : "Copy"}
                                </Button>
                            </div>

                            {/* Social Buttons */}
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handleFacebook}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2]/10 text-[#1877F2] font-semibold rounded-xl hover:bg-[#1877F2]/20 transition-colors"
                                    >
                                        <Facebook className="w-5 h-5" />
                                        Facebook
                                    </button>
                                    <button
                                        onClick={handleTwitter}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1DA1F2]/10 text-[#1DA1F2] font-semibold rounded-xl hover:bg-[#1DA1F2]/20 transition-colors"
                                    >
                                        <Twitter className="w-5 h-5" />
                                        Twitter
                                    </button>
                                </div>
                                <button
                                    onClick={handleEmail}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors w-full"
                                >
                                    <Mail className="w-5 h-5" />
                                    Share via Email
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
