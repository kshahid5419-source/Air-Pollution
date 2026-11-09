import { pgTable, serial, varchar, text, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";

export const communityReports = pgTable(
  "community_reports",
  {
    id: serial().primaryKey(),
    category: varchar("category", { length: 40 }).notNull(),
    description: text("description").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    locationName: varchar("location_name", { length: 180 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("community_reports_created_at_idx").on(t.createdAt)],
);
