// app/(app)/api/kroger/mobile-redirect/route.ts
// This page handles the redirect back to the mobile app using JavaScript
// HTTP redirects to custom URL schemes are blocked by many browsers

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") || "account";
    const params = searchParams.get("params") || "";

    const deepLink = `cartsense://${path}${params ? `?${params}` : ""}`;

    // Return an HTML page that redirects via JavaScript
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Redirecting to CartSense...</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f8fafb;
            color: #374151;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
        }
        p {
            color: #6b7280;
            margin-bottom: 1.5rem;
        }
        .button {
            display: inline-block;
            background: #4A90E2;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e5e7eb;
            border-top-color: #4A90E2;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>Redirecting to CartSense...</h1>
        <p>If you're not redirected automatically, tap the button below.</p>
        <a href="${deepLink}" class="button">Open CartSense</a>
    </div>
    <script>
        // Try to redirect immediately
        window.location.href = "${deepLink}";

        // Fallback: try again after a short delay
        setTimeout(function() {
            window.location.href = "${deepLink}";
        }, 500);
    </script>
</body>
</html>
`;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html",
        },
    });
}
