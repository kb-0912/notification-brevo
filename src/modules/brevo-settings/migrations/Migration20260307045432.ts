import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260307045432 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "brevo_settings" add column if not exists "promotion_auto_create" boolean not null default false, add column if not exists "promotion_discount_type" text not null default 'percentage', add column if not exists "promotion_discount_value" integer not null default 10, add column if not exists "promotion_expiry_days" integer not null default 30, add column if not exists "promotion_expiry_reminder_enabled" boolean not null default false, add column if not exists "promotion_expiry_reminder_template_id" text null, add column if not exists "promotion_expiry_reminder_days_before" integer not null default 3;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brevo_settings" drop column if exists "promotion_auto_create", drop column if exists "promotion_discount_type", drop column if exists "promotion_discount_value", drop column if exists "promotion_expiry_days", drop column if exists "promotion_expiry_reminder_enabled", drop column if exists "promotion_expiry_reminder_template_id", drop column if exists "promotion_expiry_reminder_days_before";`);
  }

}
