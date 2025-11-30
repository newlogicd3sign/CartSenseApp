"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";
import { Search, ShoppingCart, BookmarkCheck, User, LogOut } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const navItems = [
        { href: "/prompt", label: "Search", icon: Search },
        { href: "/shopping-list", label: "Cart", icon: ShoppingCart },
        { href: "/saved-meals", label: "Saved", icon: BookmarkCheck },
        { href: "/account", label: "Account", icon: User },
    ];

    const isActive = (href: string) => {
        if (href === "/prompt") {
            return pathname === "/prompt" || pathname.startsWith("/meals");
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="relative w-full min-h-screen bg-[#f8fafb]">
            {/* Mobile-first container with max-width for larger screens */}
            <div className="w-full max-w-[428px] mx-auto lg:max-w-4xl xl:max-w-5xl bg-[#f8fafb] min-h-screen relative">
                {/* Desktop Header - Hidden on mobile */}
                <header className="hidden lg:flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-xl flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-medium text-gray-900">CartSense</span>
                    </div>

                    <nav className="flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                                        active
                                            ? "bg-[#4A90E2]/10 text-[#4A90E2]"
                                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                    }`}
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

                {/* Page Content */}
                <main className="pb-24 lg:pb-6">
                    {children}
                </main>

                {/* Mobile Bottom Navigation - Hidden on desktop */}
                <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
                    <div className="max-w-[428px] mx-auto bg-white border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom">
                        <div className="grid grid-cols-4 gap-2 px-4 py-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="flex flex-col items-center gap-1 py-2"
                                    >
                                        <div
                                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                                                active ? "bg-[#4A90E2]/10" : ""
                                            }`}
                                        >
                                            <Icon
                                                className={`w-5 h-5 transition-colors ${
                                                    active ? "text-[#4A90E2]" : "text-gray-400"
                                                }`}
                                            />
                                        </div>
                                        <span
                                            className={`text-xs transition-colors ${
                                                active ? "text-[#4A90E2] font-medium" : "text-gray-500"
                                            }`}
                                        >
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    );
}