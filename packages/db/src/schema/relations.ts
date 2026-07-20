import { relations } from "drizzle-orm";
import { apiKeys } from "./api-keys.js";
import { auditEvents } from "./audit-events.js";
import {
	accountRelations,
	invitation,
	invitationRelations,
	member,
	memberRelations,
	organization,
	sessionRelations,
	user,
	userRelations,
} from "./better-auth.js";
import { idempotencyKeys } from "./idempotency-keys.js";
import { renders } from "./renders.js";
import { usageCounters } from "./usage-counters.js";
import { workspaceSettings } from "./workspace-settings.js";

export const workspaceSettingsRelations = relations(
	workspaceSettings,
	({ one }) => ({
		organization: one(organization, {
			fields: [workspaceSettings.organizationId],
			references: [organization.id],
		}),
	}),
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	organization: one(organization, {
		fields: [apiKeys.workspaceId],
		references: [organization.id],
	}),
}));

export const rendersRelations = relations(renders, ({ one }) => ({
	organization: one(organization, {
		fields: [renders.workspaceId],
		references: [organization.id],
	}),
}));

export const idempotencyKeysRelations = relations(
	idempotencyKeys,
	({ one }) => ({
		organization: one(organization, {
			fields: [idempotencyKeys.workspaceId],
			references: [organization.id],
		}),
	}),
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
	organization: one(organization, {
		fields: [auditEvents.workspaceId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [auditEvents.userId],
		references: [user.id],
	}),
}));

export const usageCountersRelations = relations(usageCounters, ({ one }) => ({
	organization: one(organization, {
		fields: [usageCounters.workspaceId],
		references: [organization.id],
	}),
}));

export const organizationRelations = relations(
	organization,
	({ many, one }) => ({
		members: many(member),
		invitations: many(invitation),
		workspaceSettings: one(workspaceSettings),
		apiKeys: many(apiKeys),
		renders: many(renders),
		idempotencyKeys: many(idempotencyKeys),
		auditEvents: many(auditEvents),
		usageCounters: many(usageCounters),
	}),
);

export {
	accountRelations,
	invitationRelations,
	memberRelations,
	sessionRelations,
	userRelations,
};
