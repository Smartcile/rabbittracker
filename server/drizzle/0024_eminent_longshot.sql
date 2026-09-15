ALTER TABLE "rabbit_tasks" DROP CONSTRAINT "rabbit_tasks_treatment_id_treatments_id_fk";
--> statement-breakpoint
ALTER TABLE "task_completions" DROP CONSTRAINT "task_completions_medication_log_id_medication_logs_id_fk";
--> statement-breakpoint
ALTER TABLE "rabbit_tasks" DROP COLUMN "treatment_id";--> statement-breakpoint
ALTER TABLE "task_completions" DROP COLUMN "medication_log_id";