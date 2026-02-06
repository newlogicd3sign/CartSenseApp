"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { App as CapApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { authFetch } from "@/lib/authFetch";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Search, List, BookmarkCheck, User, LogOut, Sparkles } from "lucide-react";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";
import { clearAllMealStorage, loadGeneratedMeals } from "@/lib/mealStorage";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import CartSenseProLogo from "@/app/CartSenseProLogo.svg";
import { LoadingScreen } from "@/components/LoadingScreen";
import { OfflineBanner } from "@/components/OfflineBanner";

// Check if running in Capacitor
const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#4A90E2", dark: "#357ABD" });
    const [navColors, setNavColors] = useState<Record<string, AccentColor>>({});
    const [navVisible, setNavVisible] = useState(true);
    const [navAnimating, setNavAnimating] = useState(false);
    const previousPathRef = useRef<string | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [isPremiumUser, setIsPremiumUser] = useState(false);
    const [isNativeApp, setIsNativeApp] = useState(false);

    // Detect Capacitor on mount
    useEffect(() => {
        setIsNativeApp(isCapacitor());
    }, []);

    // Handle deep links (Universal Links and custom URL scheme) for Capacitor
    useEffect(() => {
        if (!isCapacitor()) return;

        const handleAppUrlOpen = (event: URLOpenListenerEvent) => {
            try {
                const url = new URL(event.url);

                // Handle custom URL scheme (cartsense://path?params)
                if (url.protocol === "cartsense:") {
                    // For custom scheme, host is the path (e.g., cartsense://account becomes host=account)
                    const path = `/${url.host}${url.pathname}${url.search}`;

                    // Close the browser that was opened for OAuth
                    Browser.close().catch(() => {});

                    // Navigate to the path
                    router.push(path);
                    return;
                }

                // Handle Universal Links (https://cartsenseapp.com/...)
                const path = url.pathname + url.search;

                // Handle Kroger OAuth callback
                if (path.startsWith("/api/kroger/callback")) {
                    const params = url.searchParams;
                    if (params.get("kroger_linked") === "success") {
                        router.push("/account?kroger_linked=success");
                    } else if (params.has("kroger_error")) {
                        router.push(`/account?kroger_error=${params.get("kroger_error")}`);
                    }
                } else {
                    router.push(path);
                }
            } catch (err) {
                console.error("Error handling deep link:", err);
            }
        };

        CapApp.addListener("appUrlOpen", handleAppUrlOpen);

        return () => {
            CapApp.removeAllListeners();
        };
    }, [router]);

    // Check for authentication and email verification
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
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

            // Fetch user subscription status
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    const isPremium = data.isPremium === true;
                    const planType = data.planType as string | undefined;
                    // Show Pro logo for premium users or family plan members
                    setIsPremiumUser(isPremium || planType === "individual" || planType === "family");
                }
            } catch (error) {
                console.error("Error fetching user subscription status:", error);
            }

            setAuthChecked(true);

            // Check for pending share claim (for existing users who log in via share link)
            const pendingShareId = localStorage.getItem("pendingShareId");
            if (pendingShareId) {
                try {
                    // Don't await this to avoid blocking UI rendering, but handle it
                    authFetch("/api/share/claim", {
                        method: "POST",
                        body: JSON.stringify({ shareId: pendingShareId }),
                    }).then(async (res) => {
                        if (res.ok) {
                            localStorage.removeItem("pendingShareId");
                            // We can't easily show toast here since we are outside the ToastProvider context usually?
                            // Wait, AppLayout uses useToast? No, it's not imported yet.
                            // Let's rely on redirection to saved-meals to show IT worked visually?
                            // Or better: dispatch a custom event or just redirect.
                            router.push("/saved-meals");
                        }
                    });
                } catch (e) {
                    console.error("Error claiming shared meal:", e);
                }
            }
        });

        return () => unsub();
    }, [router]);

    const navItems = [
        { href: "/prompt", label: "Search", icon: Search },
        { href: "/fresh-picks", label: "Fresh Picks", icon: Sparkles },
        { href: "/shopping-list", label: "List", icon: List },
        { href: "/saved-meals", label: "Saved", icon: BookmarkCheck },
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
        return <LoadingScreen />;
    }

    const bgColor = isSetupPage ? "bg-white" : "bg-[#f8fafb]";

    const containerClass = isNativeApp ? "app-container" : "min-h-screen";

    return (
        <div className={`relative w-full ${containerClass} ${bgColor}`}>
            {/* Offline Banner */}
            <OfflineBanner />

            {/* Mobile-first container with max-width for larger screens */}
            <div className={`w-full max-w-[428px] mx-auto lg:max-w-4xl xl:max-w-5xl ${bgColor} ${containerClass} relative`}>
                {/* Desktop Header - Hidden on mobile and setup page */}
                {navVisible && (
                    <header
                        className={`hidden lg:flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30 ${navAnimating ? "animate-fade-in-down" : ""
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Image src={isPremiumUser ? CartSenseProLogo : CartSenseLogo} alt="CartSense" className="h-8 w-auto" />
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
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${active
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
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${active
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
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </header>
                )}

                {/* Page Content */}
                <main className={navVisible ? "pb-36 lg:pb-6" : ""}>
                    {children}
                </main>

                {/* Mobile Bottom Navigation - Hidden on desktop and setup page */}
                {navVisible && (
                    <nav
                        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden ${navAnimating ? "animate-fade-in-up" : ""
                            }`}
                    >
                        <div className="max-w-[428px] mx-auto bg-white border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom">
                            <div className={`grid grid-cols-5 ${isNativeApp ? "gap-0 px-1 py-1" : "gap-1 px-2 py-2"}`}>
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    const itemColor = navColors[item.href]?.primary || accentColor.primary;
                                    const isSearchItem = item.href === "/prompt";
                                    const navItemClass = isNativeApp ? "flex flex-col items-center gap-0.5 py-1" : "flex flex-col items-center gap-1 py-2";
                                    const iconContainerClass = isNativeApp ? "w-8 h-8 flex items-center justify-center rounded-lg transition-colors" : "w-9 h-9 flex items-center justify-center rounded-xl transition-colors";

                                    return isSearchItem ? (
                                        <button
                                            key={item.href}
                                            onClick={handleSearchNav}
                                            className={navItemClass}
                                        >
                                            <div
                                                className={iconContainerClass}
                                                style={active ? { backgroundColor: `${itemColor}15` } : undefined}
                                            >
                                                <Icon
                                                    className="w-5 h-5 transition-colors"
                                                    style={{ color: active ? itemColor : "#9ca3af" }}
                                                />
                                            </div>
                                            <span
                                                className={`text-[10px] transition-colors truncate max-w-full ${active ? "font-medium" : ""}`}
                                                style={{ color: active ? itemColor : "#6b7280" }}
                                            >
                                                {item.label}
                                            </span>
                                        </button>
                                    ) : (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={navItemClass}
                                        >
                                            <div
                                                className={iconContainerClass}
                                                style={active ? { backgroundColor: `${itemColor}15` } : undefined}
                                            >
                                                <Icon
                                                    className="w-5 h-5 transition-colors"
                                                    style={{ color: active ? itemColor : "#9ca3af" }}
                                                />
                                            </div>
                                            <span
                                                className={`text-[10px] transition-colors truncate max-w-full ${active ? "font-medium" : ""}`}
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