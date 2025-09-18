CREATE TYPE "public"."DidcommQuestionAnswerState" AS ENUM('question-sent', 'answer-received', 'question-received', 'answer-sent');--> statement-breakpoint
CREATE TYPE "public"."DidcommQuestionAnswerRole" AS ENUM('questioner', 'responder');--> statement-breakpoint
CREATE TABLE "DidcommQuestionAnswer" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"state" "DidcommQuestionAnswerState" NOT NULL,
	"role" "DidcommQuestionAnswerRole" NOT NULL,
	"connection_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"question_text" text NOT NULL,
	"question_detail" text,
	"valid_responses" jsonb NOT NULL,
	"signature_required" boolean NOT NULL,
	"response" text,
	CONSTRAINT "didcommQuestionAnswer_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "DidcommQuestionAnswer_context_correlation_id_thread_id_unique" UNIQUE("context_correlation_id","thread_id")
);
--> statement-breakpoint
ALTER TABLE "DidcommQuestionAnswer" ADD CONSTRAINT "didcommQuestionAnswer_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommQuestionAnswer" ADD CONSTRAINT "DidcommQuestionAnswer_connection_id_context_correlation_id_DidcommConnection_id_context_correlation_id_fk" FOREIGN KEY ("connection_id","context_correlation_id") REFERENCES "public"."DidcommConnection"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;