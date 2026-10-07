CREATE TYPE "payment_method" AS ENUM('efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro');--> statement-breakpoint
ALTER TYPE "case_event_type" ADD VALUE 'payment_applied';--> statement-breakpoint
ALTER TYPE "case_event_type" ADD VALUE 'payment_voided';--> statement-breakpoint
ALTER TYPE "case_event_type" ADD VALUE 'adjustment_added';--> statement-breakpoint
ALTER TYPE "case_status" ADD VALUE 'cobrado' BEFORE 'cancelado';--> statement-breakpoint
CREATE TABLE "account_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"clinic_id" uuid NOT NULL,
	"case_id" uuid,
	"amount" numeric(12,2) NOT NULL,
	"reason" text NOT NULL,
	"date" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_adjustments_amount_check" CHECK ("amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payment_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"clinic_id" uuid NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"reference" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	CONSTRAINT "payments_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE INDEX "account_adjustments_clinic_idx" ON "account_adjustments" ("clinic_id");--> statement-breakpoint
CREATE INDEX "account_adjustments_case_idx" ON "account_adjustments" ("case_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_case_idx" ON "payment_allocations" ("case_id");--> statement-breakpoint
CREATE INDEX "payments_clinic_idx" ON "payments" ("clinic_id");--> statement-breakpoint
ALTER TABLE "account_adjustments" ADD CONSTRAINT "account_adjustments_clinic_id_clinics_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id");--> statement-breakpoint
ALTER TABLE "account_adjustments" ADD CONSTRAINT "account_adjustments_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id");--> statement-breakpoint
ALTER TABLE "account_adjustments" ADD CONSTRAINT "account_adjustments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinic_id_clinics_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_users_id_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id");