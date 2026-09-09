import { NextResponse } from "next/server";
import { COMPOUND_SESSION_COOKIE } from "@/utils/compoundAuth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COMPOUND_SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
