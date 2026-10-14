import { NextResponse } from "next/server";
import { checkAdminCredentials, verifyAdminToken, ADMIN_SECRET_KEY } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (!checkAdminCredentials(email, password)) {
      return NextResponse.json({ error: "Invalid admin email or password." }, { status: 401 });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@evalboard.com").trim().toLowerCase();
    return NextResponse.json({
      success: true,
      token: ADMIN_SECRET_KEY,
      admin: {
        email: adminEmail,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Authentication service unavailable." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const isValid = verifyAdminToken(request);
  if (!isValid) {
    return NextResponse.json({ authenticated: false, error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@evalboard.com").trim().toLowerCase();
  return NextResponse.json({
    authenticated: true,
    admin: { email: adminEmail, role: "admin" },
  });
}
