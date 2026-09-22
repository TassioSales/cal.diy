import { prisma } from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";

import { TRPCError } from "@trpc/server";

import authedProcedure from "../../../procedures/authedProcedure";
import { webhookIdAndEventTypeIdSchema } from "./types";

/**
 * "read" lists a webhook and its secret, "write" creates, edits or deletes one.
 *
 * These mirror the webhook.read / webhook.update / webhook.delete fallback roles that
 * getFilteredWebhooksForUser already uses to decide whether the UI offers Edit and Delete. Until
 * now that decision lived only in the client: the procedures themselves never looked at teamId, so
 * a member who was shown a read-only webhook could still call webhook.edit for it directly.
 */
type WebhookAccessLevel = "read" | "write";

const TEAM_ROLES_BY_ACCESS: Record<WebhookAccessLevel, MembershipRole[]> = {
  read: [MembershipRole.MEMBER, MembershipRole.ADMIN, MembershipRole.OWNER],
  write: [MembershipRole.ADMIN, MembershipRole.OWNER],
};

type WebhookOwner =
  | { kind: "user"; userId: number }
  | { kind: "team"; teamId: number }
  | { kind: "platform" };

type ActingUser = { id: number; role?: string | null };

async function resolveEventTypeOwner(eventTypeId: number): Promise<WebhookOwner | null> {
  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    select: {
      id: true,
      userId: true,
      teamId: true,
      parent: { select: { teamId: true } },
    },
  });

  if (!eventType) {
    return null;
  }
  if (eventType.teamId) {
    return { kind: "team", teamId: eventType.teamId };
  }
  // A managed event type's child row belongs to the member it was assigned to.
  if (eventType.userId) {
    return { kind: "user", userId: eventType.userId };
  }
  if (eventType.parent?.teamId) {
    return { kind: "team", teamId: eventType.parent.teamId };
  }
  return null;
}

async function hasAccessTo(
  owner: WebhookOwner,
  user: ActingUser,
  access: WebhookAccessLevel
): Promise<boolean> {
  if (owner.kind === "platform") {
    return user.role === "ADMIN";
  }
  if (owner.kind === "user") {
    return owner.userId === user.id;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      teamId: owner.teamId,
      userId: user.id,
      accepted: true,
      role: { in: TEAM_ROLES_BY_ACCESS[access] },
    },
    select: { id: true },
  });

  return membership !== null;
}

async function assertAccessToEventType(
  eventTypeId: number,
  user: ActingUser,
  access: WebhookAccessLevel
) {
  const owner = await resolveEventTypeOwner(eventTypeId);
  if (!owner) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (!(await hasAccessTo(owner, user, access))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

async function assertAccessToTeam(teamId: number, user: ActingUser, access: WebhookAccessLevel) {
  if (!(await hasAccessTo({ kind: "team", teamId }, user, access))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

/**
 * Authorizes a call against the webhook named by `input`, or against the team / event type a new
 * webhook is being attached to.
 *
 * Exported so the decision can be tested without standing up the tRPC middleware chain.
 */
export async function assertWebhookAccess({
  input,
  user,
  access,
}: {
  input: { id?: string; webhookId?: string; eventTypeId?: number; teamId?: number };
  user: ActingUser;
  access: WebhookAccessLevel;
}): Promise<void> {
  const { id, webhookId, eventTypeId, teamId } = input;
  const lookupId = id || webhookId;

  if (!lookupId) {
    // No webhook yet: authorize against whatever the caller wants to attach it to. With neither,
    // the webhook belongs to the caller themselves.
    if (eventTypeId) {
      await assertAccessToEventType(eventTypeId, user, access);
    }
    if (teamId) {
      await assertAccessToTeam(teamId, user, access);
    }
    return;
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id: lookupId },
    select: {
      id: true,
      userId: true,
      teamId: true,
      eventTypeId: true,
      platform: true,
      platformOAuthClientId: true,
    },
  });

  if (!webhook) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // An edit spreads the remaining input into the update, so a differing eventTypeId or teamId is an
  // attempt to move the webhook to an owner the caller was never authorized against.
  if (eventTypeId && eventTypeId !== webhook.eventTypeId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (teamId && teamId !== webhook.teamId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  if (webhook.platform || webhook.platformOAuthClientId) {
    if (!(await hasAccessTo({ kind: "platform" }, user, access))) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return;
  }

  if (webhook.eventTypeId) {
    await assertAccessToEventType(webhook.eventTypeId, user, access);
    return;
  }

  if (webhook.teamId) {
    await assertAccessToTeam(webhook.teamId, user, access);
    return;
  }

  if (webhook.userId) {
    if (webhook.userId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return;
  }

  // Owned by nobody: refuse rather than fall through to the handler.
  throw new TRPCError({ code: "FORBIDDEN" });
}

/**
 * `access` defaults to "write" so a procedure added later is guarded by the stricter rule unless it
 * opts into read access.
 */
export const createWebhookProcedure = (access: WebhookAccessLevel = "write") => {
  return authedProcedure.input(webhookIdAndEventTypeIdSchema.optional()).use(async ({ ctx, input, next }) => {
    if (!input) return next();

    await assertWebhookAccess({ input, user: ctx.user, access });

    return next();
  });
};

export const webhookProcedure = createWebhookProcedure();
