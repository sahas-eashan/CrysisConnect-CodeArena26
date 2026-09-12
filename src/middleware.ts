import { NextRequest, NextResponse } from "next/server";

const guardedPrefixes = {
  "/citizen": ["citizen", "ngo", "government"],
  "/ngo": ["ngo", "government"],
  "/admin": ["government"]
} as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!Object.keys(guardedPrefixes).some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
    return NextResponse.next();
  }

  const role = request.cookies.get("cc-role")?.value;
  if (!role) {
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
