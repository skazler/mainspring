CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"side" text NOT NULL,
	"trade_date" date NOT NULL,
	"shares" numeric(18, 6) NOT NULL,
	"price" numeric(18, 4) NOT NULL,
	"fee" numeric(18, 4) DEFAULT 0 NOT NULL,
	"closes_lot_id" uuid
);
--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;