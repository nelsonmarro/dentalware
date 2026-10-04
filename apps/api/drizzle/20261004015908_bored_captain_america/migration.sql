CREATE TYPE "delivery_status" AS ENUM('pendiente', 'hecha', 'fallida');--> statement-breakpoint
CREATE TYPE "delivery_type" AS ENUM('recogida', 'entrega');--> statement-breakpoint
ALTER TYPE "case_event_type" ADD VALUE 'pickup_scheduled' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "case_event_type" ADD VALUE 'picked_up' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "case_event_type" ADD VALUE 'delivery_failed' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "case_status" ADD VALUE 'por_recoger' BEFORE 'nuevo';--> statement-breakpoint
ALTER TYPE "attachment_kind" ADD VALUE 'constancia';--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"type" "delivery_type" NOT NULL,
	"status" "delivery_status" DEFAULT 'pendiente'::"delivery_status" NOT NULL,
	"courier_id" text NOT NULL,
	"scheduled_for" date NOT NULL,
	"done_at" timestamp with time zone,
	"proof_attachment_id" uuid,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deliveries_day_idx" ON "deliveries" ("scheduled_for","status");--> statement-breakpoint
CREATE INDEX "deliveries_case_idx" ON "deliveries" ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_one_pending_idx" ON "deliveries" ("case_id","type") WHERE "status" = 'pendiente';--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_courier_id_users_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_proof_attachment_id_attachments_id_fkey" FOREIGN KEY ("proof_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL;