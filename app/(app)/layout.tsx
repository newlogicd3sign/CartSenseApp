"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const linkStyle = (path: string) => ({
        padding: "0.5rem 1rem",
        borderRadius: "8px",
        background: pathname.startsWith(path) ? "#e5e7eb" : "transparent",
        fontWeight: pathname.startsWith(path) ? 600 : 400,
        textDecoration: "none",
        color: "#111827",
    });

    return (
        <div>
            {/* NAV BAR */}
            <nav
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1.25rem",
                    borderBottom: "1px solid #e5e7eb",
                    background: "#ffffff",
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                }}
            >
                <div style={{display: "flex", gap: "0.75rem"}}>
                    <Link href="/prompt" style={linkStyle("/prompt")}>
                        Search
                    </Link>

                    <Link href="/shopping-list" style={linkStyle("/shopping-list")}>
                        Shopping list
                    </Link>

                    <Link href="/saved-meals" style={linkStyle("/saved-meals")}>
                        Saved meals
                    </Link>

                    <Link href="/account" style={linkStyle("/account")}>
                        Account
                    </Link>
                </div>


                <button
                    onClick={handleLogout}
                    style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        background: "#f9fafb",
                        cursor: "pointer",
                    }}
                >
                    Logout
                </button>
            </nav>

            {/* PAGE CONTENT */}
            <div style={{ maxWidth: 900, margin: "0 auto" }}>{children}</div>
        </div>
    );
}
