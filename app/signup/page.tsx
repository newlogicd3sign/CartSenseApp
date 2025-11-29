"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    const handleSignup = async () => {
        setMessage(null);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            // create a Firestore user doc
            await setDoc(doc(db, "users", cred.user.uid), {
                email,
                planType: "free",
                monthlyPromptCount: 0,
                promptPeriodStart: serverTimestamp(),
                createdAt: serverTimestamp(),
            });

            setMessage("Account created successfully!");
        } catch (error: any) {
            setMessage(error.message || "Something went wrong");
        }
    };

    return (
        <div style={{ padding: "2rem", maxWidth: 400 }}>
            <h1>CartSense – Sign Up</h1>

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
                onClick={handleSignup}
                style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
            >
                Create Account
            </button>

            {message && (
                <p style={{ marginTop: "1rem" }}>
                    {message}
                </p>
            )}
        </div>
    );
}
