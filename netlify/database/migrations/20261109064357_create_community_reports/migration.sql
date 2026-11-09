CREATE TABLE "community_reports" (
	"id" serial PRIMARY KEY,
	"category" varchar(40) NOT NULL,
	"description" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location_name" varchar(180),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "community_reports_created_at_idx" ON "community_reports" ("created_at");