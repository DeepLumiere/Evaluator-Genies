import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Evaluation from "@/lib/Evaluation";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized. Admin credentials required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status")?.trim().toLowerCase();

    await connectToDatabase();

    const query: Record<string, unknown> = {};
    if (filterStatus && ["pending", "approved", "rejected"].includes(filterStatus)) {
      query.status = filterStatus;
    }

    const [evaluations, total, pending, approved, rejected] = await Promise.all([
      Evaluation.find(query).sort({ createdAt: -1, evaluatedAt: -1 }).lean(),
      Evaluation.countDocuments(),
      Evaluation.countDocuments({ status: "pending" }),
      Evaluation.countDocuments({ $or: [{ status: "approved" }, { status: { $exists: false } }] }),
      Evaluation.countDocuments({ status: "rejected" }),
    ]);

    return NextResponse.json({
      evaluations,
      counts: { total, pending, approved, rejected },
    });
  } catch (error) {
    console.error("Admin evaluations query failed:", error);
    return NextResponse.json({ error: "Could not retrieve evaluations." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized. Admin credentials required." }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, model, organization, benchmark, score, metric, category, source } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Evaluation ID is required." }, { status: 400 });
    }

    await connectToDatabase();

    const updateFields: Record<string, unknown> = {};

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      updateFields.status = status;
      updateFields.reviewedAt = new Date();
      updateFields.reviewedBy = "Admin";
    }
    if (typeof model === "string") updateFields.model = model.trim();
    if (typeof organization === "string") updateFields.organization = organization.trim();
    if (typeof benchmark === "string") updateFields.benchmark = benchmark.trim();
    if (typeof metric === "string") updateFields.metric = metric.trim();
    if (typeof category === "string") updateFields.category = category.trim();
    if (typeof source === "string") updateFields.source = source.trim();
    if (typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100) {
      updateFields.score = score;
    }

    const updated = await Evaluation.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Evaluation card not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, evaluation: updated });
  } catch (error) {
    console.error("Admin update evaluation failed:", error);
    return NextResponse.json({ error: "Could not update evaluation." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized. Admin credentials required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idFromQuery = searchParams.get("id");
    let id = idFromQuery;

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch { /* Ignore JSON parse error if body is empty */ }
    }

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Evaluation ID is required." }, { status: 400 });
    }

    await connectToDatabase();
    const deleted = await Evaluation.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Admin delete evaluation failed:", error);
    return NextResponse.json({ error: "Could not delete evaluation." }, { status: 500 });
  }
}
