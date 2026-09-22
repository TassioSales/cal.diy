import { updateTriggerForExistingBookings } from "@calcom/features/webhooks/lib/scheduleTrigger";
import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import type { TDeleteInputSchema } from "./delete.schema";

type DeleteOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteInputSchema;
};

export const deleteHandler = async ({ input }: DeleteOptions) => {
  const { id } = input;

  // Ownership is settled by createWebhookProcedure("write") in ./util. Re-deriving it here with a
  // userId filter is what silently turned a team admin's delete into a no-op, because a team
  // webhook has no userId.
  const webhookToDelete = await prisma.webhook.findUnique({
    where: { id },
  });

  if (webhookToDelete) {
    await prisma.webhook.delete({
      where: {
        id: webhookToDelete.id,
      },
    });

    await updateTriggerForExistingBookings(webhookToDelete, webhookToDelete.eventTriggers, []);
  }

  return {
    id,
  };
};
