"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { Search, List, BookmarkCheck, User, LogOut } from "lucide-react";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";
import { clearAllMealStorage, loadGeneratedMeals } from "@/lib/mealStorage";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#4A90E2", dark: "#357ABD" });
    const [navColors, setNavColors] = useState<Record<string, AccentColor>>({});
    const [navVisible, setNavVisible] = useState(true);
    const [navAnimating, setNavAnimating] = useState(false);
    const previousPathRef = useRef<string | null>(null);
    const [authChecked, setAuthChecked] = useState(false);

    // Check for authentication and email verification
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) {
                // Not logged in
                router.push("/login");
                return;
            }

            // Check email verification
            if (!user.emailVerified) {
                router.push("/verify-email");
                return;
            }

            setAuthChecked(true);
        });

        return () => unsub();
    }, [router]);

    const navItems = [
        { href: "/prompt", label: "Search", icon: Search },
        { href: "/shopping-list", label: "Shopping List", icon: List },
        { href: "/saved-meals", label: "Saved Meals", icon: BookmarkCheck },
        { href: "/account", label: "Account", icon: User },
    ];

    const isSetupPage = pathname === "/setup";

    useEffect(() => {
        setAccentColor(getRandomAccentColor());
        const colors: Record<string, AccentColor> = {};
        navItems.forEach((item) => {
            colors[item.href] = getRandomAccentColor();
        });
        setNavColors(colors);
    }, []);

    // Handle nav visibility and animations based on route changes
    useEffect(() => {
        const previousPath = previousPathRef.current;

        if (isSetupPage) {
            // Hide nav on setup page
            setNavVisible(false);
            setNavAnimating(false);
        } else if (previousPath === "/setup" && pathname === "/prompt") {
            // Coming from setup to prompt - fade in the nav
            setNavVisible(true);
            setNavAnimating(true);
            // Remove animation class after animation completes
            const timer = setTimeout(() => setNavAnimating(false), 500);
            return () => clearTimeout(timer);
        } else {
            // Normal navigation - show nav without animation
            setNavVisible(true);
            setNavAnimating(false);
        }

        previousPathRef.current = pathname;
    }, [pathname, isSetupPage]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const isActive = (href: string) => {
        if (href === "/prompt") {
            return pathname === "/prompt" || pathname.startsWith("/meals");
        }
        return pathname.startsWith(href);
    };

    // Handle Search nav click
    // - If already in search flow (prompt/meals), clear storage and go to /prompt for fresh start
    // - If coming from another tab and meals exist, return to /meals to view them
    const handleSearchNav = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const isInSearchFlow = pathname === "/prompt" || pathname.startsWith("/meals");

        if (isInSearchFlow) {
            // Already in search flow - clear and start fresh
            clearAllMealStorage();
            router.push("/prompt");
        } else {
            // Coming from another tab - check if meals exist
            const stored = loadGeneratedMeals();
            if (stored && stored.meals && stored.meals.length > 0) {
                // Meals exist, go to meals list
                router.push("/meals");
            } else {
                // No meals, go to prompt
                router.push("/prompt");
            }
        }
    }, [router, pathname]);

    // Show loading state while checking auth
    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative w-full min-h-screen ${isSetupPage ? "bg-white" : "bg-[#f8fafb]"}`}>
            {/* Mobile-first container with max-width for larger screens */}
            <div className={`w-full max-w-[428px] mx-auto lg:max-w-4xl xl:max-w-5xl ${isSetupPage ? "bg-white" : "bg-[#f8fafb]"} min-h-screen relative`}>
                {/* Desktop Header - Hidden on mobile and setup page */}
                {navVisible && (
                    <header
                        className={`hidden lg:flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30 ${
                            navAnimating ? "animate-fade-in-down" : ""
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Image src={CartSenseLogo} alt="CartSense" className="h-8 w-auto" />
                        </div>

                        <nav className="flex items-center gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                const itemColor = navColors[item.href]?.primary || accentColor.primary;
                                const isSearchItem = item.href === "/prompt";

                                return isSearchItem ? (
                                    <button
                                        key={item.href}
                                        onClick={handleSearchNav}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                                            active
                                                ? ""
                                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                        }`}
                                        style={active ? { backgroundColor: `${itemColor}15`, color: itemColor } : undefined}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </button>
                                ) : (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                                            active
                                                ? ""
                                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                        }`}
                                        style={active ? { backgroundColor: `${itemColor}15`, color: itemColor } : undefined}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </header>
                )}

                {/* Page Content */}
                <main className={navVisible ? "pb-24 lg:pb-6" : ""}>
                    {children}
                </main>

                {/* Mobile Bottom Navigation - Hidden on desktop and setup page */}
                {navVisible && (
                    <nav
                        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden ${
                            navAnimating ? "animate-fade-in-up" : ""
                        }`}
                    >
                        <div className="max-w-[428px] mx-auto bg-white border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom">
                            <div className="grid grid-cols-4 gap-2 px-4 py-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    const itemColor = navColors[item.href]?.primary || accentColor.primary;
                                    const isSearchItem = item.href === "/prompt";

                                    return isSearchItem ? (
                                        <button
                                            key={item.href}
                                            onClick={handleSearchNav}
                                            className="flex flex-col items-center gap-1 py-2"
                                        >
                                            <div
                                                className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
                                                style={active ? { backgroundColor: `${itemColor}15` } : undefined}
                                            >
                                                <Icon
                                                    className="w-5 h-5 transition-colors"
                                                    style={{ color: active ? itemColor : "#9ca3af" }}
                                                />
                                            </div>
                                            <span
                                                className={`text-xs transition-colors ${active ? "font-medium" : ""}`}
                                                style={{ color: active ? itemColor : "#6b7280" }}
                                            >
                                                {item.label}
                                            </span>
                                        </button>
                                    ) : (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className="flex flex-col items-center gap-1 py-2"
                                        >
                                            <div
                                                className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
                                                style={active ? { backgroundColor: `${itemColor}15` } : undefined}
                                            >
                                                <Icon
                                                    className="w-5 h-5 transition-colors"
                                                    style={{ color: active ? itemColor : "#9ca3af" }}
                                                />
                                            </div>
                                            <span
                                                className={`text-xs transition-colors ${active ? "font-medium" : ""}`}
                                                style={{ color: active ? itemColor : "#6b7280" }}
                                            >
                                                {item.label}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </nav>
                )}
            </div>
        </div>
    );
}