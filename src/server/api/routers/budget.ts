import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, groupProcedure, protectedProcedure } from '~/server/api/trpc';

const envelopeInput = z.object({
  name: z.string().min(1).max(200),
  allocatedAmount: z.bigint().positive(),
  color: z.string().max(7).optional(),
  icon: z.string().max(10).optional(),
});

export const budgetRouter = createTRPCRouter({
  create: groupProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        totalAmount: z.bigint().positive(),
        currency: z.string().min(1).max(10),
        periodStart: z.date(),
        periodEnd: z.date(),
        envelopes: z.array(envelopeInput),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const envelopeSum = input.envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0n);
      if (envelopeSum > input.totalAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Envelope allocations exceed total budget amount',
        });
      }

      const budget = await ctx.db.budget.create({
        data: {
          groupId: input.groupId,
          name: input.name,
          totalAmount: input.totalAmount,
          currency: input.currency,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          createdBy: ctx.session.user.id,
          envelopes: {
            create: input.envelopes.map((e, i) => ({
              name: e.name,
              allocatedAmount: e.allocatedAmount,
              color: e.color,
              icon: e.icon,
              sortOrder: i,
            })),
          },
        },
        include: { envelopes: true },
      });

      return budget;
    }),

  getActive: groupProcedure.query(async ({ ctx, input }) => {
    const budget = await ctx.db.budget.findFirst({
      where: {
        groupId: input.groupId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        envelopes: {
          orderBy: { sortOrder: 'asc' },
          include: {
            charges: {
              select: {
                amount: true,
              },
            },
          },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (!budget) {
      return null;
    }

    const envelopesWithSpent = budget.envelopes.map((envelope) => {
      const spent = envelope.charges.reduce((sum, c) => sum + c.amount, 0n);
      return {
        ...envelope,
        spent,
        remaining: envelope.allocatedAmount - spent,
        charges: undefined,
      };
    });

    const totalSpent = envelopesWithSpent.reduce((sum, e) => sum + e.spent, 0n);
    const totalAllocated = envelopesWithSpent.reduce((sum, e) => sum + e.allocatedAmount, 0n);

    return {
      ...budget,
      envelopes: envelopesWithSpent,
      totalSpent,
      totalAllocated,
      unallocated: budget.totalAmount - totalAllocated,
    };
  }),

  getByGroup: groupProcedure.query(async ({ ctx, input }) => {
    const budgets = await ctx.db.budget.findMany({
      where: { groupId: input.groupId },
      orderBy: { periodStart: 'desc' },
      include: {
        _count: { select: { envelopes: true } },
      },
    });

    return budgets;
  }),

  update: groupProcedure
    .input(
      z.object({
        budgetId: z.string().min(1).max(200),
        name: z.string().min(1).max(200).optional(),
        totalAmount: z.bigint().positive().optional(),
        periodStart: z.date().optional(),
        periodEnd: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const budget = await ctx.db.budget.findUnique({
        where: { id: input.budgetId },
        include: { envelopes: true },
      });

      if (!budget) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      }

      if (budget.groupId !== input.groupId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Budget does not belong to this group' });
      }

      if (input.totalAmount) {
        const envelopeSum = budget.envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0n);
        if (envelopeSum > input.totalAmount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Envelope allocations exceed new total amount',
          });
        }
      }

      const updated = await ctx.db.budget.update({
        where: { id: input.budgetId },
        data: {
          name: input.name,
          totalAmount: input.totalAmount,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
      });

      return updated;
    }),

  delete: groupProcedure
    .input(z.object({ budgetId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const budget = await ctx.db.budget.findUnique({
        where: { id: input.budgetId },
      });

      if (!budget) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      }

      if (budget.groupId !== input.groupId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Budget does not belong to this group' });
      }

      await ctx.db.budget.delete({ where: { id: input.budgetId } });

      return budget;
    }),

  toggleActive: groupProcedure
    .input(z.object({ budgetId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const budget = await ctx.db.budget.findUnique({
        where: { id: input.budgetId },
      });

      if (!budget) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      }

      if (budget.groupId !== input.groupId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Budget does not belong to this group' });
      }

      // If activating, deactivate other budgets in the group
      if (!budget.isActive) {
        await ctx.db.budget.updateMany({
          where: { groupId: input.groupId, isActive: true },
          data: { isActive: false },
        });
      }

      const updated = await ctx.db.budget.update({
        where: { id: input.budgetId },
        data: { isActive: !budget.isActive },
      });

      return updated;
    }),
});

export type BudgetRouter = typeof budgetRouter;
