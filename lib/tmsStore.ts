'use server';

import crypto from 'crypto';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
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

async function requireWorkspace() {
  const user = await getCurrentUserAction();
  if (!user || (user.role !== 'admin' && user.role !== 'mc_owner')) {
    throw new Error('Dispatcher or MC owner access is required.');
  }
  return user;
}

async function requireAdmin() {
  const user = await requireWorkspace();
  if (user.role !== 'admin') throw new Error('Dispatcher access is required.');
  return user;
}

async function requireScopedLoad(loadId: string) {
  await requireWorkspace();
  const load = (await getLoads()).find(item => item.id === loadId);
  if (!load) throw new Error('You do not have permission to access this load.');
  return load;
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
  await requireWorkspace();

  const [loads, carriers, settlements] = await Promise.all([
    getLoads(),
    getCarriers(),
    getSettlements(),
  ]);
  const loadIds = loads.map(load => load.id);
  const carrierIds = carriers.map(carrier => carrier.id);
  const [scopedInvoices, scopedExpenses, scopedDrivers, scopedPayProfiles] = await Promise.all([
    loadIds.length ? db.select().from(schema.invoices).where(inArray(schema.invoices.loadId, loadIds)).orderBy(desc(schema.invoices.createdAt)) : Promise.resolve([]),
    loadIds.length ? db.select().from(schema.loadExpenses).where(inArray(schema.loadExpenses.loadId, loadIds)).orderBy(desc(schema.loadExpenses.incurredAt)) : Promise.resolve([]),
    carrierIds.length ? db.select().from(schema.carrierDrivers).where(and(eq(schema.carrierDrivers.status, 'active'), inArray(schema.carrierDrivers.carrierId, carrierIds))).orderBy(asc(schema.carrierDrivers.lastName)) : Promise.resolve([]),
    carrierIds.length ? db.select().from(schema.driverPayProfiles).innerJoin(schema.carrierDrivers, eq(schema.driverPayProfiles.driverId, schema.carrierDrivers.id)).where(inArray(schema.carrierDrivers.carrierId, carrierIds)).then(rows => rows.map(row => row.driver_pay_profiles)) : Promise.resolve([]),
  ]);
  return { loads, carriers, settlements, invoices: scopedInvoices, expenses: scopedExpenses, drivers: scopedDrivers, payProfiles: scopedPayProfiles };
}

export async function createInvoiceForLoad(loadId: string) {
  await requireAdmin();
  const load = await requireScopedLoad(loadId);
  if (!load) throw new Error('Load not found.');
  if (!['delivered', 'pod_received', 'invoiced', 'paid'].includes(load.status)) {
    throw new Error('A load must be delivered before it can be invoiced.');
  }
  const existing = await db.query.invoices.findFirst({ where: eq(schema.invoices.loadId, loadId) });
  if (existing) return existing.id;

  const invoiceId = crypto.randomUUID();
  const invoiceNumber = 'SNX-' + new Date().getFullYear() + '-' + crypto.randomUUID().slice(0, 8).toUpperCase();
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
  await requireScopedLoad(invoice.loadId);

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
  const load = await requireScopedLoad(input.loadId);

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
  if (!(await getCarriers()).some(carrier => carrier.id === input.carrierId)) {
    throw new Error('You do not have permission to settle this carrier.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd) || input.periodStart > input.periodEnd) {
    throw new Error('Choose a valid settlement period.');
  }
  const requestedLoadIds = Array.from(new Set(input.loadIds)).sort();
  if (!requestedLoadIds.length) throw new Error('A settlement needs at least one load.');

  const eligibleLoads = await db.select({
    id: schema.loads.id,
    rate: schema.loads.rate,
    totalFeeAmount: schema.loads.totalFeeAmount,
    carrierNet: schema.loads.carrierNet,
  }).from(schema.loads).where(and(
    eq(schema.loads.carrierId, input.carrierId),
    gte(schema.loads.deliveryDate, input.periodStart),
    lte(schema.loads.deliveryDate, input.periodEnd),
    inArray(schema.loads.status, ['delivered', 'pod_received', 'invoiced', 'paid']),
  ));
  const eligibleIds = eligibleLoads.map(load => load.id).sort();
  if (eligibleIds.length !== requestedLoadIds.length || eligibleIds.some((id, index) => id !== requestedLoadIds[index])) {
    throw new Error('Settlement loads changed. Refresh accounting before recording the settlement.');
  }

  const existingSettlements = await db.select({ loadIds: schema.settlements.loadIds })
    .from(schema.settlements)
    .where(eq(schema.settlements.carrierId, input.carrierId));
  const alreadySettled = new Set(existingSettlements.flatMap(settlement => settlement.loadIds.split(',').filter(Boolean)));
  if (requestedLoadIds.some(id => alreadySettled.has(id))) {
    throw new Error('One or more selected loads already have a carrier settlement.');
  }

  const cents = (value: number) => Math.round(Number(value) * 100);
  const grossTotal = eligibleLoads.reduce((total, load) => total + cents(Number(load.rate)), 0) / 100;
  const feeTotal = eligibleLoads.reduce((total, load) => total + cents(Number(load.totalFeeAmount)), 0) / 100;
  const netTotal = eligibleLoads.reduce((total, load) => total + cents(Number(load.carrierNet)), 0) / 100;

  await db.insert(schema.settlements).values({
    id: crypto.randomUUID(),
    carrierId: input.carrierId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    loadIds: requestedLoadIds.join(','),
    grossTotal,
    feeTotal,
    netTotal,
    generatedAt: new Date().toISOString(),
  });
}
