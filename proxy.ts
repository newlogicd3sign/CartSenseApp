import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const basicAuth = request.headers.get("authorization");

  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // If you haven't configured creds, don't block anything (useful in dev)
  if (!username || !password) {
    return NextResponse.next();
  }

  if (basicAuth?.startsWith("Basic ")) {
    const base64Credentials = basicAuth.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64")
      .toString("utf8");
    const [user, pass] = credentials.split(":");

    if (user === username && pass === password) {
      return NextResponse.next(); // allow the request through
    }
  }

  // Ask the browser to show the built-in username/password dialog
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="CartSense Private"',
    },
  });
}

// Apply to everything except static assets / images / robots / stripe webhook
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|api/stripe/webhook).*)",
  ],
};