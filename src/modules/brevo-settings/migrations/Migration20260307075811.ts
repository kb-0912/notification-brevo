import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260307075811 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "brevo_settings" add column if not exists "promotion_excluded_currencies" jsonb null, add column if not exists "promotion_code_prefix" text not null default 'WELCOME', add column if not exists "abandoned_cart_discount_excluded_currencies" jsonb null, add column if not exists "abandoned_cart_discount_code_prefix" text not null default 'COMEBACK';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brevo_settings" drop column if exists "promotion_excluded_currencies", drop column if exists "promotion_code_prefix", drop column if exists "abandoned_cart_discount_excluded_currencies", drop column if exists "abandoned_cart_discount_code_prefix";`);
  }

}
