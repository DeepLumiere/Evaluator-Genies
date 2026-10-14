import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import mongoose, { Schema } from "mongoose";

/* ── User model ── */
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);

/* Simple hash — for a production app, use bcrypt. */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, mode } = body;

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    await connectToDatabase();

    if (mode === "signup") {
      const existing = await User.findOne({ email: trimmedEmail }).lean();
      if (existing) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      const user = await User.create({ email: trimmedEmail, password: simpleHash(password) });
      return NextResponse.json({ success: true, user: { id: user._id, email: user.email } }, { status: 201 });
    }

    /* Login */
    const user = await User.findOne({ email: trimmedEmail }).lean() as { _id: string; email: string; password: string } | null;
    if (!user || user.password !== simpleHash(password)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    return NextResponse.json({ success: true, user: { id: user._id, email: user.email } });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Authentication service unavailable. Please try again." }, { status: 503 });
  }
}
