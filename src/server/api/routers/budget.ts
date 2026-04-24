import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, groupProcedure } from '~/server/api/trpc';

const envelopeInput = z.object({
  name: z.string().min(1).max(200),
  allocatedAmount: z.bigint().positive(),
  color: z.string().max(7).optional(),
  icon: z.string().max(10).optional(),
});

// Shared Prisma include for full budget details (used in getActive and getById)
const fullBudgetInclude = {
  envelopes: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      charges: {
        select: { amount: true },
      },
    },
  },
  creator: {
    select: { id: true, name: true, email: true, image: true },
  },
};

interface RawEnvelope {
  id: string;
  budgetId: string;
  name: string;
  allocatedAmount: bigint;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  charges: { amount: bigint }[];
}

function computeEnvelopesWithTotals(envelopes: RawEnvelope[]) {
  return envelopes.map((envelope) => {
    const spent = envelope.charges.reduce((sum, c) => sum + c.amount, 0n);
    return {
      id: envelope.id,
      budgetId: envelope.budgetId,
      name: envelope.name,
      allocatedAmount: envelope.allocatedAmount,
      color: envelope.color,
      icon: envelope.icon,
      sortOrder: envelope.sortOrder,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
      spent,
      remaining: envelope.allocatedAmount - spent,
    };
  });
}

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

      const budget = await ctx.db.$transaction(async (tx) => {
        await tx.budget.updateMany({
          where: { groupId: input.groupId, isActive: true },
          data: { isActive: false },
        });

        return tx.budget.create({
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
      include: fullBudgetInclude,
    });

    if (!budget) {
      return null;
    }

    const envelopes = computeEnvelopesWithTotals(budget.envelopes);
    const totalSpent = envelopes.reduce((sum, e) => sum + e.spent, 0n);
    const totalAllocated = envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0n);

    return {
      ...budget,
      envelopes,
      totalSpent,
      totalAllocated,
      unallocated: budget.totalAmount - totalAllocated,
    };
  }),

  getById: groupProcedure
    .input(z.object({ budgetId: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const budget = await ctx.db.budget.findUnique({
        where: { id: input.budgetId },
        include: fullBudgetInclude,
      });

      if (!budget) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      }

      if (budget.groupId !== input.groupId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Budget does not belong to this group' });
      }

      const envelopes = computeEnvelopesWithTotals(budget.envelopes);
      const totalSpent = envelopes.reduce((sum, e) => sum + e.spent, 0n);
      const totalAllocated = envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0n);

      return {
        ...budget,
        envelopes,
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
        envelopes: {
          select: {
            allocatedAmount: true,
            charges: { select: { amount: true } },
          },
        },
      },
    });

    return budgets.map((b) => {
      const totalAllocated = b.envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0n);
      const totalSpent = b.envelopes
        .flatMap((e) => e.charges)
        .reduce((sum, c) => sum + c.amount, 0n);
      return {
        id: b.id,
        groupId: b.groupId,
        name: b.name,
        totalAmount: b.totalAmount,
        currency: b.currency,
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
        isActive: b.isActive,
        createdBy: b.createdBy,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        envelopeCount: b.envelopes.length,
        totalAllocated,
        totalSpent,
      };
    });
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

      // Cannot deactivate the only active budget — activate another one first
      if (budget.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot deactivate the only active budget. Activate another first.',
        });
      }

      // Activating an archived budget: deactivate current active, then activate this one
      await ctx.db.budget.updateMany({
        where: { groupId: input.groupId, isActive: true },
        data: { isActive: false },
      });

      const updated = await ctx.db.budget.update({
        where: { id: input.budgetId },
        data: { isActive: true },
      });

      return updated;
    }),
});

export type BudgetRouter = typeof budgetRouter;
