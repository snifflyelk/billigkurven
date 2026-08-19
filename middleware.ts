import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminBasicAuthAuthorized } from "@/lib/admin-auth";

function unauthorizedResponse() {
  return new NextResponse("Admin authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Billigkurven Admin", charset="UTF-8"',
    },
  });
}

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedUser = process.env.ADMIN_BASIC_AUTH_USER;
  const expectedPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  const isAuthorized = isAdminBasicAuthAuthorized(authHeader, expectedUser, expectedPassword);
  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/data-quality",
    "/distribution/analytics",
  ],
};
