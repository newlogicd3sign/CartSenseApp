"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    const handleLogin = async () => {
        setMessage(null);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            setMessage("Logged in successfully!");

            // 🔥 Add this redirect
            router.push("/prompt");

        } catch (error: any) {
            setMessage(error.message || "Login failed");
        }
    };

    return (
        <div style={{ padding: "2rem", maxWidth: 400 }}>
            <h1>CartSense – Login</h1>

            <input
                type="email"
                placeholder="Email"
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", marginTop: "1rem" }}
            />

            <input
                type="password"
                placeholder="Password"
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", marginTop: "1rem" }}
            />

            <button
                onClick={handleLogin}
                style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
            >
                Login
            </button>

            {message && (
                <p style={{ marginTop: "1rem" }}>
                    {message}
                </p>
            )}
        </div>
    );
}
