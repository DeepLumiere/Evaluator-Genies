import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Evaluation from "@/lib/Evaluation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("user")?.trim().toLowerCase();

    await connectToDatabase();

    if (userEmail) {
      // Returns all cards submitted by this user (pending, approved, or rejected)
      const evaluations = await Evaluation.find({ submittedByEmail: userEmail })
        .sort({ createdAt: -1, evaluatedAt: -1 })
        .lean();
      return NextResponse.json({ evaluations, database: "connected", mode: "user" });
    }

    // Public board: only show approved evaluations (or legacy cards without status)
    const evaluations = await Evaluation.find({
      $or: [{ status: "approved" }, { status: { $exists: false } }],
    })
      .sort({ evaluatedAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ evaluations, database: "connected", mode: "public" });
  } catch (error) {
    console.error("Could not load evaluations:", error);
    return NextResponse.json({ error: "Could not connect to MongoDB. Check MONGODB_URI and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, organization, benchmark, score, metric, category, source, submittedBy, submittedByEmail } = body;
    if (![model, organization, benchmark, metric, category].every((value) => typeof value === "string" && value.trim())) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: "Score must be a number from 0 to 100." }, { status: 400 });
    }
    await connectToDatabase();
    const evaluation = await Evaluation.create({
      model: model.trim(),
      organization: organization.trim(),
      benchmark: benchmark.trim(),
      score,
      metric: metric.trim(),
      category: category.trim(),
      source: typeof source === "string" ? source.trim() : "",
      status: "pending",
      submittedBy: typeof submittedBy === "string" && submittedBy.trim() ? submittedBy.trim() : "community",
      submittedByEmail: typeof submittedByEmail === "string" && submittedByEmail.trim() ? submittedByEmail.trim().toLowerCase() : "",
    });
    return NextResponse.json({
      evaluation,
      message: "Evaluation submitted for review! It will appear on the public board once approved by an admin.",
    }, { status: 201 });
  } catch (error) {
    console.error("Could not create evaluation:", error);
    return NextResponse.json({ error: "Could not save this card. Check your MongoDB connection." }, { status: 503 });
  }
}
