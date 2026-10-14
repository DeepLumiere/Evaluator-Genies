import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Evaluation from "@/lib/Evaluation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const evaluations = await Evaluation.find().sort({ evaluatedAt: -1 }).limit(100).lean();
    return NextResponse.json({ evaluations, database: "connected" });
  } catch (error) {
    console.error("Could not load evaluations:", error);
    return NextResponse.json({ error: "Could not connect to MongoDB. Check MONGODB_URI and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, organization, benchmark, score, metric, category, source } = body;
    if (![model, organization, benchmark, metric, category].every((value) => typeof value === "string" && value.trim())) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: "Score must be a number from 0 to 100." }, { status: 400 });
    }
    await connectToDatabase();
    const evaluation = await Evaluation.create({ model, organization, benchmark, score, metric, category, source });
    return NextResponse.json({ evaluation }, { status: 201 });
  } catch (error) {
    console.error("Could not create evaluation:", error);
    return NextResponse.json({ error: "Could not save this card. Check your MongoDB connection." }, { status: 503 });
  }
}
