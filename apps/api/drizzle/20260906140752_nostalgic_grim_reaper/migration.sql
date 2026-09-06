CREATE TYPE "case_event_type" AS ENUM('created', 'status_changed', 'stage_changed', 'assigned', 'hold', 'resumed', 'tryin_sent', 'tryin_returned', 'comment', 'attachment_added', 'attachment_removed', 'shipped', 'delivered', 'cancelled', 'remake_created', 'edited', 'price_changed');--> statement-breakpoint
CREATE TYPE "case_priority" AS ENUM('normal', 'urgente');--> statement-breakpoint
CREATE TYPE "case_status" AS ENUM('nuevo', 'en_proceso', 'en_espera', 'en_prueba', 'terminado', 'enviado', 'entregado', 'cancelado');--> statement-breakpoint
CREATE TYPE "patient_sex" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "shade_system" AS ENUM('vita_classical', 'vita_3d_master', 'otro');--> statement-breakpoint
CREATE TYPE "attachment_kind" AS ENUM('photo', 'document', 'scan');--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"type" "case_event_type" NOT NULL,
	"from_value" text,
	"to_value" text,
	"reason" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"teeth" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"unit_price" numeric(10,2) NOT NULL,
	"discount_pct" numeric(5,2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(12,2) NOT NULL,
	"material" text,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_sequences" (
	"year" integer PRIMARY KEY,
	"last" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"box_number" text,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_ref" text NOT NULL,
	"patient_age" integer,
	"patient_sex" "patient_sex",
	"status" "case_status" DEFAULT 'nuevo'::"case_status" NOT NULL,
	"current_stage_id" uuid,
	"assigned_technician_id" text,
	"priority" "case_priority" DEFAULT 'normal'::"case_priority" NOT NULL,
	"received_at" date NOT NULL,
	"due_date" date,
	"promised_date" date,
	"finished_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"shade" text,
	"shade_system" "shade_system",
	"reference" text,
	"checklist" jsonb DEFAULT '{"antagonista":false,"mordida":false,"color":false,"fotos":false}' NOT NULL,
	"observations" text,
	"prescription" text,
	"internal_notes" text,
	"hold_reason" text,
	"parent_case_id" uuid,
	"remake_reason" text,
	"remake_responsibility" text,
	"remake_charge_pct" numeric(5,2),
	"total" numeric(12,2) DEFAULT '0.00' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"storage_path" text NOT NULL,
	"thumb_path" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_events" ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "case_items_case_idx" ON "case_items" ("case_id");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" ("status");--> statement-breakpoint
CREATE INDEX "cases_clinic_idx" ON "cases" ("clinic_id");--> statement-breakpoint
CREATE INDEX "cases_due_idx" ON "cases" ("promised_date","due_date");--> statement-breakpoint
CREATE INDEX "attachments_case_idx" ON "attachments" ("case_id");--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "case_items" ADD CONSTRAINT "case_items_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "case_items" ADD CONSTRAINT "case_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_clinic_id_clinics_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_doctor_id_doctors_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_current_stage_id_stages_id_fkey" FOREIGN KEY ("current_stage_id") REFERENCES "stages"("id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_technician_id_users_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id");