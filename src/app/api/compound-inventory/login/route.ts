import { NextRequest, NextResponse } from "next/server";
import {
  COMPOUND_SESSION_COOKIE,
  compoundSessionCookieOptions,
  createCompoundSession,
  verifyCompoundCredentials,
} from "@/utils/compoundAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    console.log('[LOGIN] Attempting login with:', { username, passwordLength: password.length });
    console.log('[LOGIN] ENV vars:', {
      username: process.env.COMPOUND_INVENTORY_USERNAME,
      password: process.env.COMPOUND_INVENTORY_PASSWORD
    });

    if (!verifyCompoundCredentials(username, password)) {
      console.log('[LOGIN] Verification failed');
      return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 });
    }

    console.log('[LOGIN] Verification successful');

    const response = NextResponse.json({ success: true, user: username });
    response.cookies.set(COMPOUND_SESSION_COOKIE, createCompoundSession(), compoundSessionCookieOptions);
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid login request" }, { status: 400 });
  }
}
