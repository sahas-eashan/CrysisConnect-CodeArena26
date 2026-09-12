import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, demoEnabled } from "@/lib/server-auth";

const guardedPrefixes = {
  "/citizen": ["citizen", "ngo", "government"],
  "/ngo": ["ngo", "government"],
  "/admin": ["government"]
} as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!Object.keys(guardedPrefixes).some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (demoEnabled()) {
    return NextResponse.next();
  }

  let role: string;
  try {
    role = (await authenticateRequest(request)).role;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const matchedPrefix = (Object.keys(guardedPrefixes) as Array<keyof typeof guardedPrefixes>).find((prefix) =>
    pathname.startsWith(prefix)
  );
  if (!matchedPrefix) return NextResponse.next();

  if (!guardedPrefixes[matchedPrefix].includes(role as never)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/citizen/:path*", "/ngo/:path*", "/admin/:path*"]
};
