import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261019144523 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "newsletter_subscription" drop constraint if exists "newsletter_subscription_email_unique";`);
    this.addSql(`create table if not exists "newsletter_subscription" ("id" text not null, "email" text not null, "status" text check ("status" in ('subscribed', 'unsubscribed')) not null default 'subscribed', "unsubscribe_token_hash" text not null, "welcome_email_status" text check ("welcome_email_status" in ('pending', 'disabled', 'sent', 'failed')) not null default 'pending', "welcome_email_sent_at" timestamptz null, "unsubscribed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_subscription_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscription_email_unique" ON "newsletter_subscription" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscription_deleted_at" ON "newsletter_subscription" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "newsletter_subscription" cascade;`);
  }

}
