"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getRandomAccentColor, getRandomAccentColorExcluding, ACCENT_COLORS, type AccentColor } from "@/lib/utils";
import { Sparkles, UtensilsCrossed, ChefHat, Soup, Pizza, Salad, Sandwich, Croissant, Apple, Carrot, Beef, Fish, Citrus, Drumstick, Wheat, Ham, CookingPot, Hamburger, ShieldCheck, HeartPulse, Users, ChevronRight, Clock, Wallet, Baby, CalendarDays, Home, Lightbulb, ChevronDown, Bean } from "lucide-react";
import { useToast } from "@/components/Toast";
import { loadGeneratedMeals } from "@/lib/mealStorage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { DietaryConflictModal } from "@/components/DietaryConflictModal";
import { checkPromptForConflicts, type ConflictResult, type FamilyMemberRestrictions } from "@/lib/sensitivityMapping";

const foodIcons = [
    UtensilsCrossed,
    ChefHat,
    Soup,
    Pizza,
    Salad,
    Sandwich,
    Croissant,
    Apple,
    Carrot,
    Beef,
    Fish,
    Citrus,
    Drumstick,
    Wheat,
    Ham,
    CookingPot,
    Hamburger,
];

function getRandomFoodIcon(dietType?: string) {
    let available = foodIcons;
    if (dietType === "vegetarian" || dietType === "vegan") {
        available = foodIcons.filter(icon => ![Beef, Fish, Drumstick, Ham, Hamburger].includes(icon));
    }
    return available[Math.floor(Math.random() * available.length)];
}

const foodGreetings = [
    "What's cooking today",
    "Ready to whip up something delicious",
    "Let's plan your next tasty meal",
    "Hungry for inspiration",
    "Time to get cooking",
    "What's on the menu today",
    "Let's make something amazing",
    "Craving something good",
];

function getRandomGreeting() {
    return foodGreetings[Math.floor(Math.random() * foodGreetings.length)];
}

const placeholderPrompts = [
    "Ex: Meals with ground turkey, power bowl ideas, quick chicken dinner...",
    "Ex: Easy weeknight dinners under 30 minutes...",
    "Ex: High protein meals for meal prep...",
    "Ex: Healthy salmon recipes, Mediterranean dishes...",
    "Ex: Slow cooker comfort food, set it and forget it...",
    "Ex: Kid-friendly meals the whole family will love...",
    "Ex: Low carb dinner ideas, keto friendly options...",
    "Ex: Budget-friendly meals using pantry staples...",
    "Ex: One-pan dinners for easy cleanup...",
    "Ex: Vegetarian recipes packed with protein...",
    "Ex: Quick stir fry ideas, Asian-inspired dishes...",
    "Ex: Grilled chicken variations, summer BBQ ideas...",
    "Ex: Hearty soups and stews for cozy nights...",
    "Ex: Sheet pan dinners with minimal prep...",
    "Ex: Fresh and light salads as main courses...",
];

const pantryPlaceholderPrompts = [
    "Ex: I have chicken, rice, and broccoli...",
    "Ex: Eggs, cheese, spinach, and bacon...",
    "Ex: Ground beef, pasta, canned tomatoes, onion...",
    "Ex: Salmon, lemon, garlic, and asparagus...",
    "Ex: Black beans, rice, peppers, onion, salsa...",
    "Ex: Chicken thighs, potatoes, carrots, rosemary...",
    "Ex: Shrimp, garlic, butter, pasta, parmesan...",
    "Ex: Tofu, soy sauce, ginger, vegetables, rice...",
    "Ex: Sausage, peppers, onions, and marinara...",
    "Ex: Canned tuna, mayo, bread, celery, pickles...",
];

function getRandomPlaceholder(isPantryMode = false) {
    const prompts = isPantryMode ? pantryPlaceholderPrompts : placeholderPrompts;
    return prompts[Math.floor(Math.random() * prompts.length)];
}

const quickPrompts = [
    { label: "Quick weeknight dinners", icon: Clock, prompt: "Quick weeknight dinners under 30 minutes" },
    { label: "High protein meals", icon: Beef, prompt: "High protein meals for muscle building" },
    { label: "Budget-friendly", icon: Wallet, prompt: "Budget-friendly meals using pantry staples" },
    { label: "Healthy lunch ideas", icon: Salad, prompt: "Healthy lunch ideas that are filling" },
    { label: "Weekly meal plan", icon: CalendarDays, prompt: "Meal prep recipes for the week" },
    { label: "Kid-friendly", icon: Baby, prompt: "Kid-friendly meals the whole family will love" },
];

const pantryQuickPrompts = [
    { label: "Chicken & rice", icon: Drumstick, prompt: "I have chicken, rice, onion, garlic, and some vegetables" },
    { label: "Pasta night", icon: Wheat, prompt: "I have pasta, canned tomatoes, garlic, olive oil, parmesan" },
    { label: "Eggs & veggies", icon: Salad, prompt: "I have eggs, cheese, spinach, bell peppers, onion" },
    { label: "Ground beef", icon: Beef, prompt: "I have ground beef, potatoes, onion, garlic, cheese" },
    { label: "Rice & beans", icon: CookingPot, prompt: "I have rice, black beans, onion, peppers, salsa, cheese" },
    { label: "Salmon dinner", icon: Fish, prompt: "I have salmon, lemon, garlic, butter, broccoli, rice" },
];

export default function PromptPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [name, setName] = useState("");
    const [greeting, setGreeting] = useState("");

    const [prompt, setPrompt] = useState("");
    const [monthlyPromptCount, setMonthlyPromptCount] = useState(0);
    const [monthlyPromptLimit] = useState(10);
    const [daysUntilReset, setDaysUntilReset] = useState(30);
    const [isPremium, setIsPremium] = useState(false);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#4A90E2", dark: "#357ABD" });
    const [badgeColor, setBadgeColor] = useState<AccentColor>({ primary: "#a855f7", dark: "#9333ea" });
    const [animateFromSetup, setAnimateFromSetup] = useState(false);
    const [FoodIcon, setFoodIcon] = useState<typeof UtensilsCrossed>(() => UtensilsCrossed);
    const [placeholder, setPlaceholder] = useState("");

    // Doctor diet instructions state
    const [hasDietInstructions, setHasDietInstructions] = useState(false);
    const [blockedIngredients, setBlockedIngredients] = useState<string[]>([]);
    const [blockedGroups, setBlockedGroups] = useState<string[]>([]);

    // User dietary restrictions state
    const [userAllergies, setUserAllergies] = useState<string[]>([]);
    const [userSensitivities, setUserSensitivities] = useState<string[]>([]);
    const [userDietType, setUserDietType] = useState<string | undefined>();

    // Conflict modal state
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [detectedConflicts, setDetectedConflicts] = useState<ConflictResult["conflicts"]>([]);

    // Family members state
    const [activeFamilyMemberCount, setActiveFamilyMemberCount] = useState(0);
    const [activeFamilyMemberNames, setActiveFamilyMemberNames] = useState<string[]>([]);
    const [familyMemberRestrictions, setFamilyMemberRestrictions] = useState<FamilyMemberRestrictions[]>([]);

    // Stored meals state (for "View Previous Meals" option)
    const [hasStoredMeals, setHasStoredMeals] = useState(false);
    const [storedMealsCount, setStoredMealsCount] = useState(0);
    const [storedPrompt, setStoredPrompt] = useState<string | null>(null);

    // Pantry mode state - persisted to localStorage
    const [pantryMode, setPantryMode] = useState(false);

    // Tips state - open by default, persisted to localStorage
    const [showTips, setShowTips] = useState(true);

    // Load pantry mode and tips state from localStorage on mount
    useEffect(() => {
        try {
            const savedPantry = localStorage.getItem("pantryMode");
            if (savedPantry === "true") {
                setPantryMode(true);
            }
            const savedTips = localStorage.getItem("showTips");
            if (savedTips === "false") {
                setShowTips(false);
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    // Save pantry mode to localStorage when it changes
    useEffect(() => {
        try {
            localStorage.setItem("pantryMode", pantryMode ? "true" : "false");
        } catch {
            // Ignore localStorage errors
        }
    }, [pantryMode]);

    // Save tips state to localStorage when it changes
    useEffect(() => {
        try {
            localStorage.setItem("showTips", showTips ? "true" : "false");
        } catch {
            // Ignore localStorage errors
        }
    }, [showTips]);

    // Update placeholder when pantry mode changes
    useEffect(() => {
        setPlaceholder(getRandomPlaceholder(pantryMode));
    }, [pantryMode]);

    useEffect(() => {
        // Scroll to top when page loads
        window.scrollTo(0, 0);

        setGreeting(getRandomGreeting());
        setFoodIcon(() => getRandomFoodIcon());
        setPlaceholder(getRandomPlaceholder(false));
        const primaryColor = getRandomAccentColor();
        setAccentColor(primaryColor);
        setBadgeColor(getRandomAccentColorExcluding(primaryColor));

        // Check if we should animate entry (from login or setup)
        const animateEntry = sessionStorage.getItem("animateEntry");
        if (animateEntry === "true") {
            setAnimateFromSetup(true);
            sessionStorage.removeItem("animateEntry");
        }

        // Check for stored meals from previous generation
        const stored = loadGeneratedMeals();
        if (stored && stored.meals && stored.meals.length > 0) {
            setHasStoredMeals(true);
            setStoredMealsCount(stored.meals.length);
            setStoredPrompt(stored.prompt || null);
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
            } else {
                setUser(firebaseUser);

                const ref = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setName(data.name || "");
                    setIsPremium(data.isPremium ?? false);

                    // Calculate monthly prompt usage
                    let count = data.monthlyPromptCount ?? 0;
                    const periodStart = data.promptPeriodStart;

                    // Check if period needs reset (30 days)
                    if (periodStart) {
                        const startDate = typeof periodStart.toDate === "function"
                            ? periodStart.toDate()
                            : new Date(periodStart);
                        const now = new Date();
                        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

                        if (now.getTime() - startDate.getTime() >= thirtyDaysMs) {
                            // Period expired, show as reset
                            count = 0;
                            setDaysUntilReset(30);
                        } else {
                            // Calculate days until reset
                            const resetDate = new Date(startDate.getTime() + thirtyDaysMs);
                            const days = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                            setDaysUntilReset(days);
                        }
                    }

                    setMonthlyPromptCount(count);

                    // Check for doctor diet instructions
                    const dietInstructions = data.doctorDietInstructions;
                    if (dietInstructions?.hasActiveNote) {
                        setHasDietInstructions(true);
                        setBlockedIngredients(dietInstructions.blockedIngredients || []);
                        setBlockedGroups(dietInstructions.blockedGroups || []);
                    }

                    // Load user allergies and sensitivities
                    const allergiesAndSensitivities = data.allergiesAndSensitivities;
                    if (allergiesAndSensitivities) {
                        setUserAllergies(allergiesAndSensitivities.allergies || []);
                        setUserSensitivities(allergiesAndSensitivities.sensitivities || []);
                    }

                    // Load diet type
                    if (data.dietType) {
                        setUserDietType(data.dietType);
                        // Update icon immediately if diet type found
                        setFoodIcon(() => getRandomFoodIcon(data.dietType));
                    }
                }

                // Load active family members with their dietary restrictions
                try {
                    const membersQuery = query(
                        collection(db, "users", firebaseUser.uid, "familyMembers"),
                        where("isActive", "==", true)
                    );
                    const membersSnap = await getDocs(membersQuery);
                    const activeMembers: string[] = [];
                    const memberRestrictions: FamilyMemberRestrictions[] = [];

                    membersSnap.forEach((docSnap) => {
                        const memberData = docSnap.data();
                        if (memberData.name) {
                            activeMembers.push(memberData.name);

                            // Collect dietary restrictions for conflict checking
                            memberRestrictions.push({
                                name: memberData.name,
                                allergies: memberData.allergiesAndSensitivities?.allergies || [],
                                sensitivities: memberData.allergiesAndSensitivities?.sensitivities || [],
                                dietType: memberData.dietType,
                                blockedIngredients: memberData.doctorDietInstructions?.blockedIngredients || [],
                                blockedGroups: memberData.doctorDietInstructions?.blockedGroups || []
                            });
                        }
                    });
                    setActiveFamilyMemberCount(activeMembers.length);
                    setActiveFamilyMemberNames(activeMembers);
                    setFamilyMemberRestrictions(memberRestrictions);
                } catch (err) {
                    console.error("Error loading family members", err);
                }
            }
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    // Navigate to meals page with the current prompt
    const navigateToMeals = (promptText: string) => {
        const params = new URLSearchParams({
            prompt: promptText,
            stream: "true",
        });
        if (pantryMode) {
            params.set("pantryMode", "true");
        }
        router.push(`/meals?${params.toString()}`);
    };

    const handleSubmit = () => {
        const trimmed = prompt.trim();

        if (!trimmed) {
            showToast("Please enter what kind of meals you want.", "error");
            return;
        }

        if (!user) {
            showToast("Please log in again to generate meals.", "error");
            return;
        }

        // Check for conflicts with user's and family members' dietary restrictions
        const conflictResult = checkPromptForConflicts(
            trimmed,
            userAllergies,
            userSensitivities,
            userDietType,
            blockedIngredients,
            blockedGroups,
            familyMemberRestrictions
        );

        if (conflictResult.hasConflict) {
            // Show conflict modal for all conflicts (allergies, sensitivities, diet, doctor-blocked)
            setDetectedConflicts(conflictResult.conflicts);
            setShowConflictModal(true);
            return;
        }

        // No conflicts, navigate immediately
        navigateToMeals(trimmed);
    };

    // Handle proceeding despite conflicts
    const handleProceedWithConflicts = () => {
        setShowConflictModal(false);

        // Only modify prompt for CRITICAL conflicts (allergies, doctor-blocked)
        // For sensitivities, user explicitly wants the ingredient, so don't modify
        const criticalConflictingItems = new Set<string>();
        for (const conflict of detectedConflicts) {
            if (conflict.type === "allergy" || conflict.type === "doctor_blocked") {
                criticalConflictingItems.add(conflict.matchedKeyword);
            }
        }

        // Modify the prompt ONLY if there are critical conflicts
        const originalPrompt = prompt.trim();
        const modifiedPrompt = criticalConflictingItems.size > 0
            ? `${originalPrompt} (but make it safe for my dietary restrictions - avoid ${Array.from(criticalConflictingItems).join(", ")} and use suitable alternatives)`
            : originalPrompt;

        navigateToMeals(modifiedPrompt);
    };

    // Handle quick prompt selection with conflict checking
    const handleQuickPrompt = (quickPromptText: string) => {
        const conflictResult = checkPromptForConflicts(
            quickPromptText,
            userAllergies,
            userSensitivities,
            userDietType,
            blockedIngredients,
            blockedGroups,
            familyMemberRestrictions
        );

        if (conflictResult.hasConflict) {
            // Set the prompt so the modal shows the correct text
            setPrompt(quickPromptText);
            setDetectedConflicts(conflictResult.conflicts);
            setShowConflictModal(true);
            return;
        }

        // No conflicts, navigate immediately
        navigateToMeals(quickPromptText);
    };

    if (loadingUser) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Main Content */}
            <div className="px-6 pt-8 lg:pt-12">
                <div className="max-w-2xl mx-auto">
                    {/* Greeting */}
                    <div className={`mb-6 ${animateFromSetup ? "animate-greeting-intro" : ""}`}>
                        <h1 className="text-2xl lg:text-3xl font-medium text-center text-gray-900 mb-1">
                            {greeting}{name ? `, ${name}` : ""}?
                        </h1>
                    </div>

                    {/* Diet Instructions Guardrails Card */}
                    {hasDietInstructions && (
                        <div className={`bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 mb-6 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-emerald-800 text-sm">Diet Guardrails Active</h3>
                                    <p className="text-emerald-600" style={{ fontSize: '10px' }}>Meals will comply with your diet instructions</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pantry Mode Card */}
                    <button
                        onClick={() => setPantryMode(!pantryMode)}
                        className={`w-full rounded-2xl p-4 mb-6 flex items-center justify-between transition-all ${animateFromSetup ? "animate-content-after-greeting" : ""} ${pantryMode
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400"
                            : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center ${pantryMode ? "bg-amber-100" : "bg-gray-100"
                                    }`}
                            >
                                <Home className={`w-5 h-5 ${pantryMode ? "text-amber-600" : "text-gray-500"}`} />
                            </div>
                            <div className="text-left">
                                <h3 className={`font-medium text-sm ${pantryMode ? "text-amber-800" : "text-gray-900"}`}>
                                    Pantry Mode
                                </h3>
                                <p className={`text-xs ${pantryMode ? "text-amber-600" : "text-gray-500"}`}>
                                    {pantryMode
                                        ? "Recipes only — no shopping needed"
                                        : "No need to shop? Enter what you have at home"}
                                </p>
                            </div>
                        </div>
                        {/* Toggle Switch */}
                        <div
                            className={`w-12 h-7 rounded-full p-1 transition-colors ${pantryMode ? "bg-amber-500" : "bg-gray-200"
                                }`}
                        >
                            <div
                                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${pantryMode ? "translate-x-5" : "translate-x-0"
                                    }`}
                            />
                        </div>
                    </button>

                    {/* Search Card */}
                    <div className={`bg-white rounded-2xl shadow-lg p-5 mb-6 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={placeholder || "What kind of meals would you like?"}
                            className="w-full h-28 lg:h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white resize-none transition-colors"
                            style={{ borderColor: prompt ? accentColor.primary : undefined }}
                        />

                        {/* Expandable Tips - integrated below textarea */}
                        <div className="mt-3">
                            <button
                                onClick={() => setShowTips(!showTips)}
                                className={`flex items-center gap-2 transition-colors ${pantryMode ? "text-amber-600 hover:text-amber-700" : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                <Lightbulb className="w-5 h-5" />
                                <span className="text-base font-medium">{showTips ? "Hide tips" : "Show tips"}</span>
                                <ChevronDown className={`w-5 h-5 transition-transform ${showTips ? "rotate-180" : ""}`} />
                            </button>

                            {showTips && (
                                <ul className={`mt-3 space-y-1.5 pl-6 border-l-2 ${pantryMode ? "border-amber-200" : "border-gray-100"}`}>
                                    {(pantryMode ? [
                                        "List proteins and veggies you have on hand",
                                        "Include staples like rice, pasta, canned goods",
                                        "Mention seasonings or sauces available",
                                        "No need for exact quantities",
                                    ] : [
                                        "Your diet preferences are auto-applied",
                                        "Name specific ingredients (ground turkey, chicken)",
                                        "Add cooking time (quick 20-min, slow cooker)",
                                        "Try a style (power bowl, stir fry, Mediterranean)",
                                    ]).map((tip, i) => (
                                        <li key={i} className="text-xs text-gray-500">
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!prompt.trim()}
                            className="w-full mt-4 py-4 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.dark})` }}
                        >
                            <FoodIcon className="w-5 h-5" />
                            <span>Generate Meals</span>
                        </button>

                        {/* Labels Row */}
                        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" style={{ color: badgeColor.primary }} />
                                <span className="text-sm" style={{ color: badgeColor.primary }}>AI powered</span>
                            </div>
                            {pantryMode && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
                                    <Home className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-xs font-medium text-amber-700">Pantry Mode</span>
                                </div>
                            )}
                            {hasDietInstructions && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                                    <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-xs font-medium text-emerald-700">Diet Compliant</span>
                                </div>
                            )}
                            {activeFamilyMemberCount > 0 && (
                                <div
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-full"
                                    title={`Cooking for you + ${activeFamilyMemberNames.join(", ")}`}
                                >
                                    <Users className="w-3.5 h-3.5 text-purple-600" />
                                    <span className="text-xs font-medium text-purple-700">
                                        +{activeFamilyMemberCount} household
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Disclaimer */}
                        <p className="text-center text-gray-400 mt-3" style={{ fontSize: '10px' }}>
                            CartSense can make mistakes. Check important info.
                        </p>
                    </div>

                    {/* View Stored Meals (compact) */}
                    {hasStoredMeals && (
                        <div className={`mt-4 flex justify-start ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                            <button
                                onClick={() => router.push("/meals")}
                                className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-800 shadow-sm transition-all bg-white border border-gray-200 hover:border-gray-300 hover:shadow"
                            >
                                <div
                                    className="w-7 h-7 rounded-md flex items-center justify-center"
                                    style={{ backgroundColor: `${accentColor.primary}15` }}
                                >
                                    <UtensilsCrossed className="w-4 h-4" style={{ color: accentColor.primary }} />
                                </div>
                                <span>View previous meals — {storedMealsCount} meal{storedMealsCount !== 1 ? "s" : ""}</span>
                                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                            </button>
                        </div>
                    )}

                    {/* Quick Prompt Chips */}
                    <div className={`grid grid-cols-2 gap-2 mt-3 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                        {(pantryMode ? pantryQuickPrompts : quickPrompts).map((qp, index) => {
                            let Icon = qp.icon;
                            // Override icon for vegetarians/vegans on high protein prompt
                            if (qp.label === "High protein meals" && (userDietType === "vegetarian" || userDietType === "vegan")) {
                                Icon = Bean;
                            }

                            return (
                                <button
                                    key={qp.label}
                                    onClick={() => handleQuickPrompt(qp.prompt)}
                                    className={`flex items-center gap-2 p-3 bg-white border rounded-xl transition-all text-left ${pantryMode
                                        ? "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50"
                                        : "border-gray-200 hover:border-[#4A90E2] hover:bg-[#4A90E2]/5"
                                        }`}
                                >
                                    <Icon
                                        className="w-4 h-4 flex-shrink-0"
                                        style={{ color: pantryMode ? "#d97706" : (Icon === Bean ? "#10b981" : ACCENT_COLORS[index % ACCENT_COLORS.length].primary) }}
                                    />
                                    <span className="text-sm font-medium text-gray-700">{qp.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Prompt Counter - Free Tier */}
                    {!isPremium && (
                        <div className={`mt-4 bg-white rounded-2xl border border-gray-100 p-5 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-700">Monthly usage</span>
                                <span className="text-sm text-gray-500">
                                    {monthlyPromptCount} / {monthlyPromptLimit} generations
                                </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${monthlyPromptCount >= monthlyPromptLimit
                                        ? "bg-red-500"
                                        : monthlyPromptCount >= monthlyPromptLimit * 0.8
                                            ? "bg-amber-500"
                                            : ""
                                        }`}
                                    style={{
                                        width: `${Math.min((monthlyPromptCount / monthlyPromptLimit) * 100, 100)}%`,
                                        backgroundColor: monthlyPromptCount < monthlyPromptLimit * 0.8 ? accentColor.primary : undefined
                                    }}
                                />
                            </div>
                            {monthlyPromptCount >= monthlyPromptLimit ? (
                                <p className="text-xs text-red-600 mt-2">
                                    You&apos;ve used all free prompts for this month. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                </p>
                            ) : monthlyPromptCount >= monthlyPromptLimit * 0.8 ? (
                                <p className="text-xs text-amber-600 mt-2">
                                    {monthlyPromptLimit - monthlyPromptCount} generation{monthlyPromptLimit - monthlyPromptCount !== 1 ? "s" : ""} remaining. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                </p>
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">
                                    Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                </p>
                            )}

                            {/* Upgrade CTA */}
                            <button
                                onClick={() => router.push("/upgrade")}
                                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl text-sm font-medium transition-colors"
                                style={{ background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.dark})` }}
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>Upgrade to Premium</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Dietary Conflict Warning Modal */}
            <DietaryConflictModal
                isOpen={showConflictModal}
                onClose={() => setShowConflictModal(false)}
                onProceed={handleProceedWithConflicts}
                conflicts={detectedConflicts}
                prompt={prompt.trim()}
            />
        </div>
    );
}
