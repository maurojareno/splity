import { PrismaClient, SplitType } from '@prisma/client';

import { createExpense, deleteExpense, editExpense } from '~/server/api/services/splitService';
import { dummyData } from '~/dummies';
import { calculateParticipantSplit } from '~/store/addStore';
import assert from 'node:assert';
import { settleBalances } from './seedSettlement';

const prisma = new PrismaClient();

async function createUsers() {
  await prisma.user.createMany({
    data: dummyData.users,
  });

  console.log('Finished creating users');

  return prisma.user.findMany();
}

async function createGroups() {
  for (const { members, type, ...group } of dummyData.groups) {
    await prisma.group.create({
      data: {
        ...group,
        groupUsers: {
          create: members.map((member) => ({
            userId: member.id,
          })),
        },
      },
    });
  }

  console.log('Finished creating groups');

  return prisma.group.findMany();
}

const idLookup: Map<number, string> = new Map();

async function createExpenses() {
  for (const [idx, expense] of dummyData.expenses.entries()) {
    const res = await createExpense(
      {
        ...expense,
        paidBy: expense.paidBy.id,
        participants: calculateParticipantSplit(expense as any).participants.map((p) => ({
          userId: p.id,
          amount: p.amount ?? 0n,
        })),
      },
      expense.addedBy,
    );

    await prisma.expense.update({
      where: {
        id: res!.id,
      },
      data: {
        createdAt: expense.createdAt,
      },
    });

    idLookup.set(idx, res!.id);
  }

  console.log('Finished creating expenses');

  return prisma.expense.findMany({ include: { expenseParticipants: true } });
}

async function editExpenses() {
  for (const { idx, ...expense } of dummyData.expenseEdits) {
    assert(idLookup.get(idx), `No expense ID found for index ${idx}`);
    await editExpense(
      {
        ...expense,
        expenseId: idLookup.get(idx),
        paidBy: expense.paidBy.id,
        participants: calculateParticipantSplit(expense as any).participants.map((p) => ({
          userId: p.id,
          amount: p.amount ?? 0n,
        })),
      },
      expense.updatedBy.id,
    );
  }

  console.log('Finished editing expenses');

  return prisma.expense.findMany({ include: { expenseParticipants: true } });
}

async function deleteExpenses() {
  for (const { idx, deletedBy } of dummyData.expensesToDelete) {
    assert(idLookup.get(idx), `No expense ID found for index ${idx}`);
    await deleteExpense(idLookup.get(idx)!, deletedBy.id);
  }

  console.log('Finished deleting expenses');

  return prisma.expense.findMany({ include: { expenseParticipants: true } });
}

async function createBudgets() {
  for (const budget of dummyData.budgets) {
    await prisma.budget.create({
      data: {
        groupId: budget.groupId,
        name: budget.name,
        totalAmount: budget.totalAmount,
        currency: budget.currency,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
        isActive: budget.isActive,
        createdBy: budget.createdBy,
        envelopes: {
          create: budget.envelopes.map((env) => ({
            name: env.name,
            allocatedAmount: env.allocatedAmount,
            icon: env.icon,
            color: env.color,
            sortOrder: env.sortOrder,
            charges: {
              create: env.charges.map((charge) => ({
                amount: charge.amount,
                description: charge.description,
                date: charge.date,
                createdBy: charge.createdBy,
              })),
            },
          })),
        },
      },
    });
  }

  console.log(`Finished creating ${dummyData.budgets.length} budgets with envelopes`);
}

async function main() {
  // await prisma.user.deleteMany();
  // await prisma.expense.deleteMany();
  // await prisma.expenseParticipant.deleteMany();
  // await prisma.group.deleteMany();
  // await prisma.groupUser.deleteMany();
  // await prisma.groupBalance.deleteMany();
  await createUsers();
  await createGroups();
  await createExpenses();
  await editExpenses();
  await deleteExpenses();
  await settleBalances(prisma, dummyData.balancesToSettle);
  await createBudgets();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch(console.log);
  });
