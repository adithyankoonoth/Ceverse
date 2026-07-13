import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { assertDealMember } from "@/services/deal.service";
import type { sendMessageSchema } from "@/validation/message";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";

type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function getOrCreateDirectConversation(userId: string, recipientId: string) {
  if (userId === recipientId) {
    throw new ValidationError("Cannot message yourself");
  }
  const existing = await db.conversation.findFirst({
    where: {
      dealId: null,
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: recipientId } } },
      ],
    },
    include: { members: true },
  });
  if (existing && existing.members.length === 2) return existing;

  return db.conversation.create({
    data: {
      members: {
        create: [{ userId }, { userId: recipientId }],
      },
    },
    include: { members: true },
  });
}

export async function sendMessage(userId: string, input: SendMessageInput) {
  let conversationId = input.conversationId;

  if (!conversationId && input.dealId) {
    await assertDealMember(input.dealId, userId);
    const conv = await db.conversation.findUnique({ where: { dealId: input.dealId } });
    if (conv) {
      conversationId = conv.id;
    } else {
      const created = await db.conversation.create({
        data: {
          dealId: input.dealId,
          title: "Deal chat",
          members: { create: [{ userId }] },
        },
      });
      conversationId = created.id;
    }
  }

  if (!conversationId && input.recipientId) {
    const conv = await getOrCreateDirectConversation(userId, input.recipientId);
    conversationId = conv.id;
  }

  if (!conversationId) {
    throw new ValidationError("Unable to resolve conversation");
  }

  const member = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  if (!member) {
    // Allow deal members to join conversation on first message
    if (input.dealId) {
      await assertDealMember(input.dealId, userId);
      await db.conversationMember.create({
        data: { conversationId, userId },
      });
    } else {
      throw new ForbiddenError("Not a conversation member");
    }
  }

  const message = await db.message.create({
    data: {
      conversationId,
      dealId: input.dealId,
      senderId: userId,
      body: input.body,
      parentId: input.parentId,
      attachments: input.attachments as Prisma.InputJsonValue,
      readBy: [userId],
    },
    include: {
      sender: { select: { id: true, name: true, image: true } },
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function listConversations(userId: string) {
  return db.conversation.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: {
          // conversationMember has userId only — join user separately if needed
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true, image: true } } },
      },
    },
    take: 50,
  });
}

export async function listMessages(userId: string, conversationId: string, cursor?: string) {
  const member = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!member) throw new ForbiddenError("Not a conversation member");

  const messages = await db.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: { select: { id: true, name: true, image: true } },
      replies: {
        take: 5,
        include: { sender: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return messages.reverse();
}

export async function pinMessage(userId: string, messageId: string, pinned: boolean) {
  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message?.conversationId) throw new NotFoundError("Message", messageId);
  const member = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: message.conversationId, userId },
    },
  });
  if (!member) throw new ForbiddenError();
  return db.message.update({
    where: { id: messageId },
    data: { isPinned: pinned },
  });
}
