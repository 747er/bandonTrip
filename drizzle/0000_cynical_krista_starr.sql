CREATE TABLE "event_attendees" (
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "event_attendees_event_id_participant_id_pk" PRIMARY KEY("event_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"group_id" uuid,
	"party_size" integer,
	"reservation_note" text DEFAULT '' NOT NULL,
	"private_note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "group_members_group_id_participant_id_pk" PRIMARY KEY("group_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lodgings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hometown" text DEFAULT '' NOT NULL,
	"caddie" text DEFAULT '' NOT NULL,
	"lodging_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"private_phone" text DEFAULT '' NOT NULL,
	"private_email" text DEFAULT '' NOT NULL,
	"private_notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"event_id" uuid,
	"course_name" text NOT NULL,
	"par" integer DEFAULT 72 NOT NULL,
	"date" date NOT NULL,
	"counts_toward_total" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"gross" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_round_id_participant_id_pk" PRIMARY KEY("round_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "tee_time_players" (
	"tee_time_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "tee_time_players_tee_time_id_participant_id_pk" PRIMARY KEY("tee_time_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "tee_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"time" text NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"visibility" text DEFAULT 'unlisted' NOT NULL,
	"hero_image_url" text,
	"hero_image_credit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_lodging_id_lodgings_id_fk" FOREIGN KEY ("lodging_id") REFERENCES "public"."lodgings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tee_time_players" ADD CONSTRAINT "tee_time_players_tee_time_id_tee_times_id_fk" FOREIGN KEY ("tee_time_id") REFERENCES "public"."tee_times"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tee_time_players" ADD CONSTRAINT "tee_time_players_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_owner_id_organizers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."organizers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;