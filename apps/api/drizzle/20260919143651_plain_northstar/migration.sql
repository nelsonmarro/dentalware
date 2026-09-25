CREATE TABLE "case_tryins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"sent_at" date NOT NULL,
	"returned_at" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_tryins" ADD CONSTRAINT "case_tryins_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE;