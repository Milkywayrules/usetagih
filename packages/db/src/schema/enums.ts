import { pgEnum } from "drizzle-orm/pg-core";

export const workspaceTierEnum = pgEnum("workspace_tier", [
	"trial",
	"starter",
	"pro",
	"business",
]);

export const renderStatusEnum = pgEnum("render_status", [
	"processing",
	"completed",
	"failed",
]);
