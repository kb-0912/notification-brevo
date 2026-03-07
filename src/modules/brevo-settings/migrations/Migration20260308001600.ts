import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260308001600 extends Migration {

    override async up(): Promise<void> {
        this.addSql(`alter table if exists "brevo_settings" add column if not exists "abandoned_cart_discount_excluded_countries" jsonb null;`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table if exists "brevo_settings" drop column if exists "abandoned_cart_discount_excluded_countries";`);
    }

}
