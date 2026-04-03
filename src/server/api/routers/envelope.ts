import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';

/**
 * Helper: verify the user belongs to the group that owns the budget/envelope.
 */
async function verifyEnvelopeAccess(
  db: any,
  envelopeId: string,
  userId: number,
): Promise<{ envelope: any; budget: any }> {
  const envelope = await db.envelope.findUnique({
    where: { id: envelopeId },
    include: {
      budget: {
        include: {
          group: {
            include: {
              groupUsers: { where: { userId } },
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Envelope not found' });
  }

  if (envelope.budget.group.groupUsers.length === 0) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this group' });
  }

  return { envelope, budget: envelope.budget };
}

async function verifyBudgetAccess(db: any, budgetId: string, userId: number) {
  const budget = await db.budget.findUnique({
    where: { id: budgetId },
    include: {
      group: {
        include: {
          groupUsers: { where: { userId } },
        },
      },
    },
  });

  if (!budget) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
  }

  if (budget.group.groupUsers.length === 0) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this group' });
  }

  return budget;
}

export const envelopeRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        budgetId: z.string().min(1).max(200),
        name: z.string().min(1).max(200),
        allocatedAmount: z.bigint().positive(),
        color: z.string().max(7).optional(),
        icon: z.string().max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const budget = await verifyBudgetAccess(ctx.db, input.budgetId, ctx.session.user.id);

      // Check that the new envelope doesn't exceed the budget
      const existingTotal = await ctx.db.envelope.aggregate({
        where: { budgetId: input.budgetId },
        _sum: { allocatedAmount: true },
      });

      const currentAllocated = existingTotal._sum.allocatedAmount ?? 0n;
      if (currentAllocated + input.allocatedAmount > budget.totalAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Allocation would exceed total budget amount',
        });
      }

      const maxOrder = await ctx.db.envelope.aggregate({
        where: { budgetId: input.budgetId },
        _max: { sortOrder: true },
      });

      const envelope = await ctx.db.envelope.create({
        data: {
          budgetId: input.budgetId,
          name: input.name,
          allocatedAmount: input.allocatedAmount,
          color: input.color,
          icon: input.icon,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        },
      });

      return envelope;
    }),

  update: protectedProcedure
    .input(
      z.object({
        envelopeId: z.string().min(1).max(200),
        name: z.string().min(1).max(200).optional(),
        allocatedAmount: z.bigint().positive().optional(),
        color: z.string().max(7).optional(),
        icon: z.string().max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { envelope, budget } = await verifyEnvelopeAccess(
        ctx.db,
        input.envelopeId,
        ctx.session.user.id,
      );

      if (input.allocatedAmount) {
        const existingTotal = await ctx.db.envelope.aggregate({
          where: { budgetId: envelope.budgetId },
          _sum: { allocatedAmount: true },
        });

        const currentAllocated = existingTotal._sum.allocatedAmount ?? 0n;
        const diff = input.allocatedAmount - envelope.allocatedAmount;
        if (currentAllocated + diff > budget.totalAmount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Allocation would exceed total budget amount',
          });
        }
      }

      const updated = await ctx.db.envelope.update({
        where: { id: input.envelopeId },
        data: {
          name: input.name,
          allocatedAmount: input.allocatedAmount,
          color: input.color,
          icon: input.icon,
        },
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ envelopeId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await verifyEnvelopeAccess(ctx.db, input.envelopeId, ctx.session.user.id);

      await ctx.db.envelope.delete({ where: { id: input.envelopeId } });

      return { success: true };
    }),

  charge: protectedProcedure
    .input(
      z.object({
        envelopeId: z.string().min(1).max(200),
        amount: z.bigint().positive(),
        description: z.string().min(1).max(500),
        date: z.date().optional(),
        expenseId: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyEnvelopeAccess(ctx.db, input.envelopeId, ctx.session.user.id);

      const charge = await ctx.db.envelopeCharge.create({
        data: {
          envelopeId: input.envelopeId,
          amount: input.amount,
          description: input.description,
          date: input.date ?? new Date(),
          createdBy: ctx.session.user.id,
          expenseId: input.expenseId,
        },
      });

      return charge;
    }),

  deleteCharge: protectedProcedure
    .input(z.object({ chargeId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const charge = await ctx.db.envelopeCharge.findUnique({
        where: { id: input.chargeId },
        include: { envelope: true },
      });

      if (!charge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
      }

      await verifyEnvelopeAccess(ctx.db, charge.envelopeId, ctx.session.user.id);

      await ctx.db.envelopeCharge.delete({ where: { id: input.chargeId } });

      return { success: true };
    }),

  getSummary: protectedProcedure
    .input(z.object({ envelopeId: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      await verifyEnvelopeAccess(ctx.db, input.envelopeId, ctx.session.user.id);

      const envelope = await ctx.db.envelope.findUnique({
        where: { id: input.envelopeId },
        include: {
          budget: { select: { currency: true, periodStart: true, periodEnd: true } },
          charges: { select: { amount: true, date: true } },
        },
      });

      if (!envelope) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Envelope not found' });
      }

      const spent = envelope.charges.reduce(
        (sum: bigint, c: { amount: bigint }) => sum + c.amount,
        0n,
      );
      const remaining = envelope.allocatedAmount - spent;

      // Daily average
      const periodMs = envelope.budget.periodEnd.getTime() - envelope.budget.periodStart.getTime();
      const elapsedMs = Math.max(
        Date.now() - envelope.budget.periodStart.getTime(),
        86400000, // Min 1 day
      );
      const elapsedDays = Math.ceil(elapsedMs / 86400000);
      const totalDays = Math.ceil(periodMs / 86400000);
      const dailyAverage = elapsedDays > 0 ? spent / BigInt(elapsedDays) : 0n;
      const projectedTotal = totalDays > 0 ? dailyAverage * BigInt(totalDays) : spent;

      return {
        id: envelope.id,
        name: envelope.name,
        allocatedAmount: envelope.allocatedAmount,
        spent,
        remaining,
        currency: envelope.budget.currency,
        dailyAverage,
        projectedTotal,
        chargeCount: envelope.charges.length,
      };
    }),

  getCharges: protectedProcedure
    .input(
      z.object({
        envelopeId: z.string().min(1).max(200),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifyEnvelopeAccess(ctx.db, input.envelopeId, ctx.session.user.id);

      const charges = await ctx.db.envelopeCharge.findMany({
        where: { envelopeId: input.envelopeId },
        orderBy: { date: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          creator: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (charges.length > input.limit) {
        const next = charges.pop();
        nextCursor = next?.id;
      }

      return { charges, nextCursor };
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        budgetId: z.string().min(1).max(200),
        envelopeIds: z.array(z.string().min(1).max(200)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyBudgetAccess(ctx.db, input.budgetId, ctx.session.user.id);

      await ctx.db.$transaction(
        input.envelopeIds.map((id, index) =>
          ctx.db.envelope.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
      );

      return { success: true };
    }),
});

export type EnvelopeRouter = typeof envelopeRouter;
