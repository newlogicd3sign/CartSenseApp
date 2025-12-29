
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminAuth } from "@/lib/firebaseAdmin";

import { VerificationEmail } from "@/components/emails/VerificationEmail";

import { render } from "@react-email/render";

const resend = new Resend(process.env.RESEND_API_KEY || "re_123");
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@updates.cartsenseapp.com";

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // 1. Generate Link
        let link;
        try {
            // Generate the standard Firebase link first
            const firebaseLink = await adminAuth.generateEmailVerificationLink(email);

            // Extract the oobCode (this is the secret token)
            const urlObj = new URL(firebaseLink);
            const oobCode = urlObj.searchParams.get("oobCode");

            if (!oobCode) {
                throw new Error("Could not extract oobCode from Firebase link");
            }

            // Construct our custom in-app link
            // Dynamic base URL based on environment
            const baseUrl = process.env.NODE_ENV === "development"
                ? "http://localhost:3000"
                : "https://cartsenseapp.com";

            link = `${baseUrl}/auth/verify?code=${oobCode}`;

        } catch (e: any) {
            console.error("Error generating link:", e);
            throw new Error(`Link generation failed: ${e.message}`);
        }

        // 2. Render Email HTML
        let emailHtml;
        try {
            console.log("Rendering email HTML...");
            emailHtml = await render(<VerificationEmail link={link} />);
            console.log("Email rendered successfully");
        } catch (e: any) {
            console.error("Error rendering email HTML:", e);
            // Fallback to simple text if rendering fails? 
            // Or just throw to see the error. Let's throw for now.
            throw new Error(`Email rendering failed: ${e.message}`);
        }

        // 3. Send Email
        console.log("Sending email via Resend...");
        const { data, error } = await resend.emails.send({
            from: `CartSense <${FROM_EMAIL}>`,
            to: email,
            subject: "Verify your email for CartSense",
            html: emailHtml,
        });

        if (error) {
            console.error("Resend API error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("Email sent successfully:", data);
        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error("Verification fatal error:", err);
        return NextResponse.json({
            error: err.message || "Internal Server Error",
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 });
    }
}
