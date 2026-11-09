import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { communityReports } from "../../db/schema.js";
import { HttpError, errorResponse } from "../lib/air.js";

const CATEGORIES = new Set(["smoke", "dust", "burning", "industrial", "other"]);
const STATUSES = new Set(["pending", "verified", "rejected"]);

const SUGGESTIONS: Record<string, string> = {
  smoke: "Record time and area; persistent smoke can be raised with local environmental authorities under the polluter-pays principle.",
  dust: "Note construction or road activity; dust-control measures are often required by local environmental regulation.",
  burning: "Avoid approaching the source; open burning frequently violates local air-quality and waste rules.",
  industrial: "Document location and time from a safe public place; request inspection citing applicable emission standards.",
  other: "Collect clear, non-identifying observations so moderators can classify the issue and link it to relevant rights frameworks.",
};

type Row = typeof communityReports.$inferSelect;

// Keep the snake_case response shape the frontend expects.
const toOut = (r: Row) => ({
  id: r.id,
  category: r.category,
  description: r.description,
  latitude: r.latitude,
  longitude: r.longitude,
  location_name: r.locationName,
  status: r.status,
  created_at: r.createdAt,
});

function validateReport(body: any) {
  if (!body || typeof body !== "object") throw new HttpError(422, "Invalid request body");
  const { category, description, latitude, longitude, location_name } = body;
  if (typeof category !== "string" || !CATEGORIES.has(category)) throw new HttpError(422, "Invalid category");
  if (typeof description !== "string" || description.length < 10 || description.length > 1200)
    throw new HttpError(422, "Description must be 10–1200 characters");
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (latitude === null || latitude === "" || !Number.isFinite(lat) || lat < -90 || lat > 90)
    throw new HttpError(422, "Latitude must be between -90 and 90");
  if (longitude === null || longitude === "" || !Number.isFinite(lon) || lon < -180 || lon > 180)
    throw new HttpError(422, "Longitude must be between -180 and 180");
  if (location_name != null && (typeof location_name !== "string" || location_name.length > 180))
    throw new HttpError(422, "Location name must be at most 180 characters");
  return {
    category,
    description,
    latitude: lat,
    longitude: lon,
    locationName: location_name || null,
    status: "pending",
  };
}

async function communityInsights() {
  const reports = await db.select().from(communityReports).orderBy(desc(communityReports.createdAt)).limit(500);
  const counts: Record<string, number> = {};
  for (const r of reports) {
    if (r.status !== "rejected") counts[r.category] = (counts[r.category] ?? 0) + 1;
  }
  let mostCommon: string | null = null;
  for (const [cat, n] of Object.entries(counts)) {
    if (mostCommon === null || n > counts[mostCommon]) mostCommon = cat;
  }
  return {
    total_reports: reports.length,
    category_counts: counts,
    most_reported: mostCommon,
    suggested_action:
      (mostCommon && SUGGESTIONS[mostCommon]) ||
      "Encourage residents to submit specific, factual observations that can support accountability.",
    pending_reports: reports.filter((r) => r.status === "pending").length,
    verified_reports: reports.filter((r) => r.status === "verified").length,
    note: "Community submissions are observations, not verified pollution measurements.",
  };
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  try {
    if (path === "/api/community-insights" && req.method === "GET") {
      return Response.json(await communityInsights());
    }

    if (path === "/api/reports") {
      if (req.method === "GET") {
        const status = url.searchParams.get("status");
        if (status && !STATUSES.has(status)) throw new HttpError(400, "Invalid status");
        const query = db.select().from(communityReports);
        const rows = await (status ? query.where(eq(communityReports.status, status)) : query)
          .orderBy(desc(communityReports.createdAt))
          .limit(200);
        return Response.json(rows.map(toOut));
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => null);
        const [row] = await db.insert(communityReports).values(validateReport(body)).returning();
        return Response.json(toOut(row), { status: 201 });
      }
    }

    if (path.endsWith("/verify") && req.method === "PATCH") {
      // DEMO ONLY: add moderator authentication/authorization before real deployment.
      const id = Number(context.params.id);
      if (!Number.isInteger(id)) throw new HttpError(422, "Invalid report id");
      const decision = url.searchParams.get("decision");
      if (decision !== "verified" && decision !== "rejected")
        throw new HttpError(422, "decision must be 'verified' or 'rejected'");
      const [row] = await db
        .update(communityReports)
        .set({ status: decision })
        .where(eq(communityReports.id, id))
        .returning();
      if (!row) throw new HttpError(404, "Report not found");
      return Response.json(toOut(row));
    }

    return Response.json({ detail: "Method not allowed" }, { status: 405 });
  } catch (err) {
    return errorResponse(err);
  }
};

export const config: Config = {
  path: ["/api/reports", "/api/reports/:id/verify", "/api/community-insights"],
};
