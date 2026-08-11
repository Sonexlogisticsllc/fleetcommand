'use server';

import crypto from 'crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { getCarriers, getLoads, getSettlements } from '@/lib/sonexStore';
import { getCurrentUserAction } from '@/lib/authActions';

export type OperationalTaskInput = {
  loadId?: string;
  carrierId?: string;
  title: string;
  category?: 'dispatch' | 'billing' | 'maintenance' | 'exception';
  priority?: 'low' | 'normal' | 'high';
  assigneeName?: string;
  dueAt?: string;
  notes?: string;
};

async function requireAdmin() {
  const user = await getCurrentUserAction();
  if (!user || user.role !== 'admin') {
    throw new Error('Dispatcher access is required.');
  }
}

export async function getPlanningBoardData() {
  await requireAdmin();

  const [loads, carriers, drivers, equipment, tasks, maintenance, dispatchers, dispatcherAssignments] = await Promise.all([
    getLoads(),
    getCarriers(),
    db.select().from(schema.carrierDrivers).where(eq(schema.carrierDrivers.status, 'active')).orderBy(asc(schema.carrierDrivers.lastName)),
    db.select().from(schema.carrierEquipment).where(eq(schema.carrierEquipment.status, 'active')).orderBy(asc(schema.carrierEquipment.type)),
    db.select().from(schema.operationalTasks).where(inArray(schema.operationalTasks.status, ['open', 'in_progress'])).orderBy(desc(schema.operationalTasks.createdAt)),
    db.select().from(schema.maintenanceTasks).where(inArray(schema.maintenanceTasks.status, ['scheduled', 'in_progress'])).orderBy(asc(schema.maintenanceTasks.dueAt)),
    db.select({ id: schema.users.id, displayName: schema.users.displayName, email: schema.users.email }).from(schema.users).where(eq(schema.users.role, 'admin')).orderBy(asc(schema.users.displayName)),
    db.select().from(schema.loadDispatchAssignments),
  ]);

  return { loads, carriers, drivers, equipment, tasks, maintenance, dispatchers, dispatcherAssignments };
}

export async function assignLoadToDriver(loadId: string, driverId: string) {
  await requireAdmin();

  const driver = await db.query.carrierDrivers.findFirst({
    where: eq(schema.carrierDrivers.id, driverId),
  });
  if (!driver || driver.status !== 'active') {
    throw new Error('Choose an active driver.');
  }

  const equipment = await db.query.carrierEquipment.findFirst({
    where: and(
      eq(schema.carrierEquipment.carrierId, driver.carrierId),
      eq(schema.carrierEquipment.type, 'truck'),
      eq(schema.carrierEquipment.status, 'active'),
    ),
    orderBy: asc(schema.carrierEquipment.createdAt),
  });

  const load = await db.query.loads.findFirst({ where: eq(schema.loads.id, loadId) });
  if (!load) throw new Error('Load not found.');

  await db.update(schema.loads)
    .set({
      carrierId: driver.carrierId,
      driverId,
      equipmentId: equipment?.id,
      status: load.status === 'booked' ? 'dispatched' : load.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.loads.id, loadId));
}

export async function assignLoadToDispatcher(loadId: string, dispatcherId: string) {
  await requireAdmin();

  const [load, dispatcher] = await Promise.all([
    db.query.loads.findFirst({ where: eq(schema.loads.id, loadId) }),
    db.query.users.findFirst({ where: eq(schema.users.id, dispatcherId) }),
  ]);
  if (!load) throw new Error('Load not found.');
  if (!dispatcher || dispatcher.role !== 'admin') throw new Error('Choose an active dispatcher.');

  await db.insert(schema.loadDispatchAssignments)
    .values({ loadId, dispatcherId, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: schema.loadDispatchAssignments.loadId,
      set: { dispatcherId, updatedAt: new Date().toISOString() },
    });
}

export async function createOperationalTask(input: OperationalTaskInput) {
  await requireAdmin();
  if (!input.title.trim()) throw new Error('A task title is required.');

  const id = crypto.randomUUID();
  await db.insert(schema.operationalTasks).values({
    id,
    loadId: input.loadId,
    carrierId: input.carrierId,
    title: input.title.trim(),
    category: input.category ?? 'dispatch',
    priority: input.priority ?? 'normal',
    status: 'open',
    assigneeName: input.assigneeName,
    dueAt: input.dueAt,
    notes: input.notes ?? '',
  });

  return id;
}

export async function completeOperationalTask(taskId: string) {
  await requireAdmin();
  await db.update(schema.operationalTasks)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.operationalTasks.id, taskId));
}

export type MaintenanceTaskInput = {
  equipmentId: string;
  title: string;
  dueAt?: string;
  estimatedCost?: number;
  vendorName?: string;
  notes?: string;
};

export async function getFleetManagementData() {
  await requireAdmin();

  const [equipment, carriers, maintenance] = await Promise.all([
    db.select().from(schema.carrierEquipment).orderBy(asc(schema.carrierEquipment.type), asc(schema.carrierEquipment.make)),
    getCarriers(),
    db.select().from(schema.maintenanceTasks).orderBy(asc(schema.maintenanceTasks.dueAt)),
  ]);

  return { equipment, carriers, maintenance };
}

export async function createMaintenanceTask(input: MaintenanceTaskInput) {
  await requireAdmin();
  if (!input.title.trim()) throw new Error('A maintenance task title is required.');

  const equipment = await db.query.carrierEquipment.findFirst({
    where: eq(schema.carrierEquipment.id, input.equipmentId),
  });
  if (!equipment) throw new Error('Equipment not found.');

  const id = crypto.randomUUID();
  await db.insert(schema.maintenanceTasks).values({
    id,
    equipmentId: equipment.id,
    carrierId: equipment.carrierId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    estimatedCost: input.estimatedCost,
    vendorName: input.vendorName,
    notes: input.notes ?? '',
  });
  return id;
}

export async function completeMaintenanceTask(taskId: string) {
  await requireAdmin();
  await db.update(schema.maintenanceTasks)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.maintenanceTasks.id, taskId));
}

export async function updateEquipmentStatus(equipmentId: string, status: 'active' | 'inactive') {
  await requireAdmin();
  await db.update(schema.carrierEquipment)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(schema.carrierEquipment.id, equipmentId));
}

export async function getAccountingWorkspaceData() {
  await requireAdmin();

  const [loads, carriers, settlements, invoices, expenses, drivers, payProfiles] = await Promise.all([
    getLoads(),
    getCarriers(),
    getSettlements(),
    db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)),
    db.select().from(schema.loadExpenses).orderBy(desc(schema.loadExpenses.incurredAt)),
    db.select().from(schema.carrierDrivers).where(eq(schema.carrierDrivers.status, 'active')).orderBy(asc(schema.carrierDrivers.lastName)),
    db.select().from(schema.driverPayProfiles),
  ]);
  return { loads, carriers, settlements, invoices, expenses, drivers, payProfiles };
}

export async function createInvoiceForLoad(loadId: string) {
  await requireAdmin();
  const load = await db.query.loads.findFirst({ where: eq(schema.loads.id, loadId) });
  if (!load) throw new Error('Load not found.');
  if (!['delivered', 'pod_received', 'invoiced', 'paid'].includes(load.status)) {
    throw new Error('A load must be delivered before it can be invoiced.');
  }
  const existing = await db.query.invoices.findFirst({ where: eq(schema.invoices.loadId, loadId) });
  if (existing) return existing.id;

  const invoiceCount = await db.select().from(schema.invoices);
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = 'SNX-' + new Date().getFullYear() + '-' + String(invoiceCount.length + 1).padStart(4, '0');
  await db.insert(schema.invoices).values({
    id: invoiceId,
    invoiceNumber,
    loadId,
    customerName: load.brokerName,
    amount: load.rate,
    status: 'draft',
    notes: 'Generated from load ' + load.loadNumber,
  });
  await db.update(schema.loads)
    .set({ status: load.status === 'paid' ? 'paid' : 'invoiced', updatedAt: new Date().toISOString() })
    .where(eq(schema.loads.id, loadId));
  return invoiceId;
}

export async function setInvoiceStatus(invoiceId: string, status: 'draft' | 'sent' | 'paid') {
  await requireAdmin();
  const invoice = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, invoiceId) });
  if (!invoice) throw new Error('Invoice not found.');

  const now = new Date().toISOString();
  await db.update(schema.invoices)
    .set({
      status,
      issuedAt: status === 'draft' ? invoice.issuedAt : invoice.issuedAt ?? now,
      paidAt: status === 'paid' ? now : invoice.paidAt,
      updatedAt: now,
    })
    .where(eq(schema.invoices.id, invoiceId));

  if (status === 'paid') {
    await db.update(schema.loads).set({ status: 'paid', updatedAt: now }).where(eq(schema.loads.id, invoice.loadId));
  }
}

export async function addLoadExpense(input: {
  loadId: string;
  category: string;
  amount: number;
  incurredAt: string;
  vendorName?: string;
  notes?: string;
}) {
  await requireAdmin();
  if (!input.category.trim() || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter a valid payable expense.');
  }
  const load = await db.query.loads.findFirst({ where: eq(schema.loads.id, input.loadId) });
  if (!load) throw new Error('Load not found.');

  await db.insert(schema.loadExpenses).values({
    id: crypto.randomUUID(),
    loadId: input.loadId,
    carrierId: load.carrierId,
    category: input.category.trim(),
    amount: input.amount,
    incurredAt: input.incurredAt,
    vendorName: input.vendorName,
    notes: input.notes ?? '',
  });
}

export async function recordCarrierSettlement(input: {
  carrierId: string;
  periodStart: string;
  periodEnd: string;
  loadIds: string[];
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
}) {
  await requireAdmin();
  if (!input.loadIds.length) throw new Error('A settlement needs at least one load.');

  await db.insert(schema.settlements).values({
    id: crypto.randomUUID(),
    carrierId: input.carrierId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    loadIds: input.loadIds.join(','),
    grossTotal: input.grossTotal,
    feeTotal: input.feeTotal,
    netTotal: input.netTotal,
    generatedAt: new Date().toISOString(),
  });
}
