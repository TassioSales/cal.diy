import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => {
  const mockPrisma = {
    webhook: { findUnique: vi.fn() },
    eventType: { findUnique: vi.fn() },
    membership: { findFirst: vi.fn() },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import { prisma } from "@calcom/prisma";

import { assertWebhookAccess } from "./util";

const MEMBER = { id: 2, role: "USER" };
const OUTSIDER = { id: 99, role: "USER" };
const INSTANCE_ADMIN = { id: 50, role: "ADMIN" };

const teamWebhook = {
  id: "wh_team",
  userId: null,
  teamId: 10,
  eventTypeId: null,
  platform: false,
  platformOAuthClientId: null,
};

const personalWebhook = {
  id: "wh_personal",
  userId: 1,
  teamId: null,
  eventTypeId: null,
  platform: false,
  platformOAuthClientId: null,
};

const eventTypeWebhook = {
  id: "wh_event_type",
  userId: null,
  teamId: null,
  eventTypeId: 77,
  platform: false,
  platformOAuthClientId: null,
};

/** Stands in for a membership row matching the where clause the middleware builds. */
const grantMembershipWhenRoleIn = (roles: string[]) => {
  vi.mocked(prisma.membership.findFirst).mockImplementation((async (args: {
    where: { role: { in: string[] } };
  }) => {
    const allowed = args.where.role.in;
    return roles.some((role) => allowed.includes(role)) ? { id: 1 } : null;
  }) as never);
};

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toMatchObject({ code });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.membership.findFirst).mockResolvedValue(null as never);
});

describe("assertWebhookAccess", () => {
  describe("team webhook", () => {
    beforeEach(() => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(teamWebhook as never);
    });

    it("refuses a write from a team MEMBER", async () => {
      grantMembershipWhenRoleIn(["MEMBER"]);

      await expectCode(
        assertWebhookAccess({ input: { id: "wh_team" }, user: MEMBER, access: "write" }),
        "FORBIDDEN"
      );
    });

    it("allows a read for a team MEMBER", async () => {
      grantMembershipWhenRoleIn(["MEMBER"]);

      await expect(
        assertWebhookAccess({ input: { id: "wh_team" }, user: MEMBER, access: "read" })
      ).resolves.toBeUndefined();
    });

    it.each(["ADMIN", "OWNER"])("allows a write for a team %s", async (role) => {
      grantMembershipWhenRoleIn([role]);

      await expect(
        assertWebhookAccess({ input: { id: "wh_team" }, user: MEMBER, access: "write" })
      ).resolves.toBeUndefined();
    });

    it("refuses a read from someone outside the team", async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue(null as never);

      await expectCode(
        assertWebhookAccess({ input: { id: "wh_team" }, user: OUTSIDER, access: "read" }),
        "FORBIDDEN"
      );
    });

    it("only counts accepted memberships", async () => {
      await assertWebhookAccess({ input: { id: "wh_team" }, user: MEMBER, access: "read" }).catch(
        () => undefined
      );

      expect(prisma.membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ accepted: true }) })
      );
    });

    it("refuses an instance admin who is not on the team", async () => {
      await expectCode(
        assertWebhookAccess({ input: { id: "wh_team" }, user: INSTANCE_ADMIN, access: "write" }),
        "FORBIDDEN"
      );
    });
  });

  describe("personal webhook", () => {
    beforeEach(() => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(personalWebhook as never);
    });

    it("allows its owner", async () => {
      await expect(
        assertWebhookAccess({ input: { id: "wh_personal" }, user: { id: 1 }, access: "write" })
      ).resolves.toBeUndefined();
    });

    it("refuses another user", async () => {
      await expectCode(
        assertWebhookAccess({ input: { id: "wh_personal" }, user: OUTSIDER, access: "read" }),
        "FORBIDDEN"
      );
    });

    it("refuses an instance admin who does not own it", async () => {
      await expectCode(
        assertWebhookAccess({ input: { id: "wh_personal" }, user: INSTANCE_ADMIN, access: "write" }),
        "FORBIDDEN"
      );
    });
  });

  describe("event type webhook", () => {
    beforeEach(() => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(eventTypeWebhook as never);
    });

    it("allows a team admin on a team event type", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue({
        id: 77,
        userId: null,
        teamId: 10,
        parent: null,
      } as never);
      grantMembershipWhenRoleIn(["ADMIN"]);

      await expect(
        assertWebhookAccess({ input: { id: "wh_event_type" }, user: MEMBER, access: "write" })
      ).resolves.toBeUndefined();
    });

    it("refuses someone outside the owning team", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue({
        id: 77,
        userId: null,
        teamId: 10,
        parent: null,
      } as never);

      await expectCode(
        assertWebhookAccess({ input: { id: "wh_event_type" }, user: OUTSIDER, access: "read" }),
        "FORBIDDEN"
      );
    });

    it("allows the owner of a personal event type", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue({
        id: 77,
        userId: 1,
        teamId: null,
        parent: null,
      } as never);

      await expect(
        assertWebhookAccess({ input: { id: "wh_event_type" }, user: { id: 1 }, access: "write" })
      ).resolves.toBeUndefined();
    });

    it("refuses another user on a personal event type", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue({
        id: 77,
        userId: 1,
        teamId: null,
        parent: null,
      } as never);

      await expectCode(
        assertWebhookAccess({ input: { id: "wh_event_type" }, user: OUTSIDER, access: "write" }),
        "FORBIDDEN"
      );
    });

    it("falls back to the parent team for a managed event type with no owner", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue({
        id: 77,
        userId: null,
        teamId: null,
        parent: { teamId: 10 },
      } as never);
      grantMembershipWhenRoleIn(["ADMIN"]);

      await expect(
        assertWebhookAccess({ input: { id: "wh_event_type" }, user: MEMBER, access: "write" })
      ).resolves.toBeUndefined();
    });

    it("reports a missing event type as not found", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue(null as never);

      await expectCode(
        assertWebhookAccess({ input: { id: "wh_event_type" }, user: MEMBER, access: "read" }),
        "NOT_FOUND"
      );
    });
  });

  describe("platform webhook", () => {
    it.each([
      ["platform flag", { ...personalWebhook, userId: null, platform: true }],
      ["an oauth client", { ...personalWebhook, userId: null, platformOAuthClientId: "client_1" }],
    ])("allows only an instance admin for a webhook with %s", async (_label, webhook) => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(webhook as never);

      await expect(
        assertWebhookAccess({ input: { id: webhook.id }, user: INSTANCE_ADMIN, access: "write" })
      ).resolves.toBeUndefined();

      await expectCode(
        assertWebhookAccess({ input: { id: webhook.id }, user: MEMBER, access: "read" }),
        "FORBIDDEN"
      );
    });
  });

  describe("moving a webhook to another owner", () => {
    it("refuses a teamId that differs from the stored one", async () => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(teamWebhook as never);
      grantMembershipWhenRoleIn(["OWNER"]);

      await expectCode(
        assertWebhookAccess({
          input: { id: "wh_team", teamId: 999 },
          user: MEMBER,
          access: "write",
        }),
        "FORBIDDEN"
      );
    });

    it("refuses an eventTypeId that differs from the stored one", async () => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(eventTypeWebhook as never);

      await expectCode(
        assertWebhookAccess({
          input: { id: "wh_event_type", eventTypeId: 123 },
          user: MEMBER,
          access: "write",
        }),
        "FORBIDDEN"
      );
    });

    it("accepts a teamId that matches the stored one", async () => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(teamWebhook as never);
      grantMembershipWhenRoleIn(["ADMIN"]);

      await expect(
        assertWebhookAccess({ input: { id: "wh_team", teamId: 10 }, user: MEMBER, access: "write" })
      ).resolves.toBeUndefined();
    });
  });

  describe("creating a webhook", () => {
    it("refuses a teamId the caller is not an admin of", async () => {
      grantMembershipWhenRoleIn(["MEMBER"]);

      await expectCode(
        assertWebhookAccess({ input: { teamId: 10 }, user: MEMBER, access: "write" }),
        "FORBIDDEN"
      );
      expect(prisma.webhook.findUnique).not.toHaveBeenCalled();
    });

    it("allows a teamId the caller administers", async () => {
      grantMembershipWhenRoleIn(["ADMIN"]);

      await expect(
        assertWebhookAccess({ input: { teamId: 10 }, user: MEMBER, access: "write" })
      ).resolves.toBeUndefined();
    });

    it("refuses an eventTypeId owned by another user", async () => {
      vi.mocked(prisma.eventType.findUnique).mockResolvedValue({
        id: 77,
        userId: 1,
        teamId: null,
        parent: null,
      } as never);

      await expectCode(
        assertWebhookAccess({ input: { eventTypeId: 77 }, user: OUTSIDER, access: "write" }),
        "FORBIDDEN"
      );
    });

    it("allows a personal webhook with no team or event type", async () => {
      await expect(
        assertWebhookAccess({ input: {}, user: MEMBER, access: "write" })
      ).resolves.toBeUndefined();
    });
  });

  describe("webhooks that resolve to no owner", () => {
    it("reports an unknown webhook id as not found", async () => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(null as never);

      await expectCode(
        assertWebhookAccess({ input: { id: "missing" }, user: MEMBER, access: "read" }),
        "NOT_FOUND"
      );
    });

    it("refuses a webhook that belongs to nobody", async () => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue({
        id: "wh_orphan",
        userId: null,
        teamId: null,
        eventTypeId: null,
        platform: false,
        platformOAuthClientId: null,
      } as never);

      await expectCode(
        assertWebhookAccess({ input: { id: "wh_orphan" }, user: MEMBER, access: "read" }),
        "FORBIDDEN"
      );
    });

    it("accepts webhookId as an alias for id", async () => {
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(personalWebhook as never);

      await expect(
        assertWebhookAccess({ input: { webhookId: "wh_personal" }, user: { id: 1 }, access: "read" })
      ).resolves.toBeUndefined();
    });
  });
});
