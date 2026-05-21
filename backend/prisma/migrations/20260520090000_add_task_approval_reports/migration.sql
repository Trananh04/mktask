-- CreateEnum
CREATE TYPE "TaskStatusChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskDailyReportType" AS ENUM ('START_OF_DAY', 'END_OF_DAY');

-- CreateEnum
CREATE TYPE "TaskDailyReportStatus" AS ENUM ('SUBMITTED', 'REVIEWED');

-- CreateTable
CREATE TABLE "task_status_change_requests" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "requested_status_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "status" "TaskStatusChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requester_note" TEXT,
    "manager_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_status_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_daily_reports" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "type" "TaskDailyReportType" NOT NULL,
    "content" TEXT NOT NULL,
    "blockers" TEXT,
    "progress_percent" INTEGER,
    "status" "TaskDailyReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by_id" UUID,
    "manager_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_status_change_requests_task_id_status_idx" ON "task_status_change_requests"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_status_change_requests_requested_by_id_status_idx" ON "task_status_change_requests"("requested_by_id", "status");

-- CreateIndex
CREATE INDEX "task_status_change_requests_created_at_idx" ON "task_status_change_requests"("created_at");

-- CreateIndex
CREATE INDEX "task_daily_reports_report_date_type_idx" ON "task_daily_reports"("report_date", "type");

-- CreateIndex
CREATE INDEX "task_daily_reports_reporter_id_report_date_idx" ON "task_daily_reports"("reporter_id", "report_date");

-- CreateIndex
CREATE UNIQUE INDEX "task_daily_reports_task_id_reporter_id_report_date_type_key" ON "task_daily_reports"("task_id", "reporter_id", "report_date", "type");

-- AddForeignKey
ALTER TABLE "task_status_change_requests" ADD CONSTRAINT "task_status_change_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_change_requests" ADD CONSTRAINT "task_status_change_requests_requested_status_id_fkey" FOREIGN KEY ("requested_status_id") REFERENCES "task_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_change_requests" ADD CONSTRAINT "task_status_change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_change_requests" ADD CONSTRAINT "task_status_change_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_daily_reports" ADD CONSTRAINT "task_daily_reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_daily_reports" ADD CONSTRAINT "task_daily_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_daily_reports" ADD CONSTRAINT "task_daily_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
