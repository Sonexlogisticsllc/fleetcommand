'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Columns3,
  Loader2, MapPin, Plus, RefreshCw, Truck, UserRound, Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SonexLoad } from '@/lib/sonexTypes';
import {
  assignLoadToDispatcher,
  assignLoadToDriver,
  completeOperationalTask,
  createOperationalTask,
  getPlanningBoardData,
} from '@/lib/tmsStore';

type PlannerDriver = {
  id: string;
  carrierId: string;
  firstName: string;
  lastName: string;
  status: string;
};

type PlannerTask = {
  id: string;
  loadId: string | null;
  title: string;
  priority: string;
  status: string;
  dueAt: string | null;
};

type MaintenanceTask = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  equipmentId: string;
};

type PlannerDispatcher = { id: string; displayName: string; email: string };
type DispatcherAssignment = { loadId: string; dispatcherId: string };

type PlanningData = {
  loads: SonexLoad[];
  drivers: PlannerDriver[];
  tasks: PlannerTask[];
  maintenance: MaintenanceTask[];
  dispatchers: PlannerDispatcher[];
  dispatcherAssignments: DispatcherAssignment[];
};

const ACTIVE_LOAD_STATUSES = new Set(['booked', 'dispatched', 'in_transit']);

const statusTone: Record<string, string> = {
  booked: 'bg-slate-100 text-slate-700',
  dispatched: 'bg-blue-50 text-blue-700',
  in_transit: 'bg-amber-50 text-amber-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  pod_received: 'bg-teal-50 text-teal-700',
};

function formatDate(value: string | null) {
  if (!value) return 'No due date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function LoadCard({
  load,
  drivers,
  dispatchers,
  dispatcherId,
  busyLoadId,
  busyDispatcherLoadId,
  onAssign,
  onAssignDispatcher,
  hasConflict = false,
}: {
  load: SonexLoad;
  drivers: PlannerDriver[];
  dispatchers: PlannerDispatcher[];
  dispatcherId?: string;
  busyLoadId: string | null;
  busyDispatcherLoadId: string | null;
  onAssign: (loadId: string, driverId: string) => void;
  onAssignDispatcher: (loadId: string, dispatcherId: string) => void;
  hasConflict?: boolean;
}) {
  return (
    <article className="border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/sonex/loads/${load.id}`} className="font-mono text-xs font-bold text-slate-900 hover:text-blue-700">
          {load.loadNumber}
        </Link>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${statusTone[load.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {load.status.replace('_', ' ')}
        </span>
      </div>
      {hasConflict && <p className="mt-2 border-l-2 border-red-500 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Schedule conflict: overlapping assignment</p>}
      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-700">
        <MapPin size={12} className="text-slate-400" />
        {load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}
      </p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{new Date(load.pickupDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span className="font-mono text-slate-700">{load.miles.toLocaleString()} mi</span>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-2">
        <label className="sr-only" htmlFor={`assign-${load.id}`}>Assign driver</label>
        <select
          id={`assign-${load.id}`}
          value={load.driverId ?? ''}
          disabled={busyLoadId === load.id}
          onChange={event => {
            if (event.target.value) onAssign(load.id, event.target.value);
          }}
          className="w-full border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">Assign driver</option>
          {drivers.map(driver => (
            <option key={driver.id} value={driver.id}>
              {driver.firstName} {driver.lastName}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`dispatcher-${load.id}`}>Assign dispatcher</label>
        <select
          id={`dispatcher-${load.id}`}
          value={dispatcherId ?? ''}
          disabled={busyDispatcherLoadId === load.id}
          onChange={event => {
            if (event.target.value) onAssignDispatcher(load.id, event.target.value);
          }}
          className="mt-2 w-full border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">Assign dispatcher</option>
          {dispatchers.map(dispatcher => <option key={dispatcher.id} value={dispatcher.id}>{dispatcher.displayName}</option>)}
        </select>
      </div>
    </article>
  );
}

export default function PlanningPage() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyLoadId, setBusyLoadId] = useState<string | null>(null);
  const [busyDispatcherLoadId, setBusyDispatcherLoadId] = useState<string | null>(null);
  const [view, setView] = useState<'driver' | 'dispatcher' | 'calendar'>('driver');
  const [anchorDate, setAnchorDate] = useState(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; });
  const [taskTitle, setTaskTitle] = useState('');
  const [taskLoadId, setTaskLoadId] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getPlanningBoardData());
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not load planning data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeLoads = useMemo(
    () => data?.loads.filter(load => ACTIVE_LOAD_STATUSES.has(load.status)) ?? [],
    [data],
  );
  const unassignedLoads = activeLoads.filter(load => !load.driverId);
  const metrics = [
    { label: 'Active loads', value: activeLoads.length, Icon: Truck },
    { label: 'Unassigned', value: unassignedLoads.length, Icon: UserRound },
    { label: 'Open tasks', value: data?.tasks.length ?? 0, Icon: ClipboardList },
    { label: 'Maintenance due', value: data?.maintenance.length ?? 0, Icon: Wrench },
  ];
  const driverLoads = new Map<string, SonexLoad[]>();
  activeLoads.forEach(load => {
    if (!load.driverId) return;
    const items = driverLoads.get(load.driverId) ?? [];
    items.push(load);
    driverLoads.set(load.driverId, items);
  });
  const dispatcherByLoad = useMemo(() => new Map((data?.dispatcherAssignments ?? []).map(assignment => [assignment.loadId, assignment.dispatcherId])), [data]);
  const dispatcherLoads = new Map<string, SonexLoad[]>();
  activeLoads.forEach(load => {
    const dispatcherId = dispatcherByLoad.get(load.id);
    if (!dispatcherId) return;
    const items = dispatcherLoads.get(dispatcherId) ?? [];
    items.push(load);
    dispatcherLoads.set(dispatcherId, items);
  });
  const unassignedDispatcherLoads = activeLoads.filter(load => !dispatcherByLoad.has(load.id));
  const conflictLoadIds = useMemo(() => {
    const conflicts = new Set<string>();
    const findConflicts = (keyFor: (load: SonexLoad) => string | undefined) => {
      const groups = new Map<string, SonexLoad[]>();
      activeLoads.forEach(load => {
        const key = keyFor(load);
        if (!key) return;
        const group = groups.get(key) ?? [];
        group.push(load);
        groups.set(key, group);
      });
      groups.forEach(group => {
        const dates = new Map<string, SonexLoad[]>();
        group.forEach(load => {
          const dateGroup = dates.get(load.pickupDate) ?? [];
          dateGroup.push(load);
          dates.set(load.pickupDate, dateGroup);
        });
        dates.forEach(dateGroup => { if (dateGroup.length > 1) dateGroup.forEach(load => conflicts.add(load.id)); });
      });
    };
    findConflicts(load => load.driverId);
    findConflicts(load => dispatcherByLoad.get(load.id));
    return conflicts;
  }, [activeLoads, dispatcherByLoad]);
  const calendarDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchorDate);
    day.setDate(anchorDate.getDate() + index);
    return day;
  }), [anchorDate]);
  const calendarLoads = useMemo(() => new Map(calendarDays.map(day => [formatIsoDate(day), [] as SonexLoad[]])), [calendarDays]);
  activeLoads.forEach(load => {
    const loads = calendarLoads.get(load.pickupDate);
    if (loads) loads.push(load);
  });
  const periodLabel = anchorDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + calendarDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const assignDriver = async (loadId: string, driverId: string) => {
    setBusyLoadId(loadId);
    try {
      await assignLoadToDriver(loadId, driverId);
      toast.success('Load assigned and moved to dispatch.');
      await reload();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not assign driver.');
    } finally {
      setBusyLoadId(null);
    }
  };

  const assignDispatcher = async (loadId: string, dispatcherId: string) => {
    setBusyDispatcherLoadId(loadId);
    try {
      await assignLoadToDispatcher(loadId, dispatcherId);
      toast.success('Dispatcher ownership updated.');
      await reload();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not assign dispatcher.');
    } finally {
      setBusyDispatcherLoadId(null);
    }
  };

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    setCreatingTask(true);
    try {
      await createOperationalTask({
        title: taskTitle,
        loadId: taskLoadId || undefined,
        priority: 'normal',
      });
      setTaskTitle('');
      setTaskLoadId('');
      toast.success('Dispatch task created.');
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create task.');
    } finally {
      setCreatingTask(false);
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      await completeOperationalTask(taskId);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not complete task.');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    );
  }

  return (
    <div data-tms-surface className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <CalendarDays size={14} />
              Dispatch operations
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">Planning board</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reload}
              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
              title="Refresh planning board"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <Link href="/sonex/loads" className="inline-flex items-center gap-2 bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800">
              <Plus size={14} />
              New load
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
        <section className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {metrics.map(({ label, value, Icon }) => {
            return (
              <div key={label} className="flex items-center gap-3 bg-white px-4 py-3">
                <Icon size={17} className="text-slate-400" />
                <div>
                  <p className="text-lg font-semibold text-slate-950">{value}</p>
                  <p className="text-[11px] font-medium text-slate-500">{label}</p>
                </div>
              </div>
            );
          })}
        </section>

        {conflictLoadIds.size > 0 && <div className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"><span><strong>{conflictLoadIds.size}</strong> active load{conflictLoadIds.size === 1 ? '' : 's'} share an assignment date and need review.</span><span className="font-bold uppercase tracking-wider">Conflict indicator</span></div>}

        <section className="border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Load planning</h2>
              <p className="mt-0.5 text-xs text-slate-500">Plan by driver or dispatcher, then confirm the week in the operating calendar.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-slate-200 bg-white">
                <button onClick={() => setAnchorDate(current => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })} className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900" title="Previous week"><ChevronLeft size={15} /></button>
                <button onClick={() => { const today = new Date(); today.setHours(0, 0, 0, 0); setAnchorDate(today); }} className="border-x border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">{periodLabel}</button>
                <button onClick={() => setAnchorDate(current => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })} className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900" title="Next week"><ChevronRight size={15} /></button>
              </div>
              <div className="flex border border-slate-200 bg-white p-0.5">
                <button onClick={() => setView('driver')} className={'inline-flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold ' + (view === 'driver' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}><Columns3 size={13} />Driver</button>
                <button onClick={() => setView('dispatcher')} className={'px-2 py-1.5 text-[11px] font-semibold ' + (view === 'dispatcher' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}>Dispatcher</button>
                <button onClick={() => setView('calendar')} className={'inline-flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold ' + (view === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}><CalendarDays size={13} />7-day Gantt</button>
              </div>
            </div>
          </div>

          {view === 'driver' && <div className="overflow-x-auto"><div className="grid min-w-[980px] grid-flow-col auto-cols-[248px] gap-3 p-3">
            <div className="border border-dashed border-slate-300 bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">Unassigned driver</h3><span className="bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{unassignedLoads.length}</span></div><div className="space-y-2">{unassignedLoads.map(load => <LoadCard key={load.id} load={load} drivers={data?.drivers ?? []} dispatchers={data?.dispatchers ?? []} dispatcherId={dispatcherByLoad.get(load.id)} busyLoadId={busyLoadId} busyDispatcherLoadId={busyDispatcherLoadId} onAssign={assignDriver} onAssignDispatcher={assignDispatcher} />)}{!unassignedLoads.length && <p className="py-5 text-center text-xs text-slate-400">Every active load has a driver.</p>}</div></div>
            {(data?.drivers ?? []).map(driver => { const assigned = driverLoads.get(driver.id) ?? []; return <div key={driver.id} className="border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center bg-slate-800 text-[10px] font-semibold text-white">{driver.firstName[0]}{driver.lastName[0]}</div><div className="min-w-0"><h3 className="truncate text-xs font-semibold text-slate-800">{driver.firstName} {driver.lastName}</h3><p className="text-[10px] text-emerald-600">Available</p></div><span className="ml-auto text-[10px] text-slate-400">{assigned.length} loads</span></div><div className="space-y-2">{assigned.map(load => <LoadCard key={load.id} load={load} drivers={data?.drivers ?? []} dispatchers={data?.dispatchers ?? []} dispatcherId={dispatcherByLoad.get(load.id)} busyLoadId={busyLoadId} busyDispatcherLoadId={busyDispatcherLoadId} onAssign={assignDriver} onAssignDispatcher={assignDispatcher} />)}{!assigned.length && <p className="py-5 text-center text-xs text-slate-400">No active assignment</p>}</div></div>; })}
          </div></div>}

          {view === 'dispatcher' && <div className="overflow-x-auto"><div className="grid min-w-[900px] grid-flow-col auto-cols-[248px] gap-3 p-3">
            <div className="border border-dashed border-slate-300 bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">Unassigned dispatcher</h3><span className="bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{unassignedDispatcherLoads.length}</span></div><div className="space-y-2">{unassignedDispatcherLoads.map(load => <LoadCard key={load.id} load={load} drivers={data?.drivers ?? []} dispatchers={data?.dispatchers ?? []} dispatcherId={dispatcherByLoad.get(load.id)} busyLoadId={busyLoadId} busyDispatcherLoadId={busyDispatcherLoadId} onAssign={assignDriver} onAssignDispatcher={assignDispatcher} />)}{!unassignedDispatcherLoads.length && <p className="py-5 text-center text-xs text-slate-400">Every active load has an owner.</p>}</div></div>
            {(data?.dispatchers ?? []).map(dispatcher => { const assigned = dispatcherLoads.get(dispatcher.id) ?? []; return <div key={dispatcher.id} className="border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center bg-blue-700 text-[10px] font-semibold text-white">{dispatcher.displayName.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><h3 className="truncate text-xs font-semibold text-slate-800">{dispatcher.displayName}</h3><p className="truncate text-[10px] text-slate-500">{dispatcher.email}</p></div><span className="ml-auto text-[10px] text-slate-400">{assigned.length} loads</span></div><div className="space-y-2">{assigned.map(load => <LoadCard key={load.id} load={load} drivers={data?.drivers ?? []} dispatchers={data?.dispatchers ?? []} dispatcherId={dispatcherByLoad.get(load.id)} busyLoadId={busyLoadId} busyDispatcherLoadId={busyDispatcherLoadId} onAssign={assignDriver} onAssignDispatcher={assignDispatcher} />)}{!assigned.length && <p className="py-5 text-center text-xs text-slate-400">No active ownership</p>}</div></div>; })}
          </div></div>}

          {view === 'calendar' && <div className="overflow-x-auto"><div className="grid min-w-[940px] grid-cols-7 divide-x divide-slate-200"><div className="col-span-7 grid grid-cols-7 border-b border-slate-200 bg-slate-50">{calendarDays.map(day => <div key={formatIsoDate(day)} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>)}</div>{calendarDays.map(day => { const loads = calendarLoads.get(formatIsoDate(day)) ?? []; const isToday = formatIsoDate(day) === formatIsoDate(new Date()); return <div key={formatIsoDate(day)} className="min-h-[238px] p-2.5"><div className={'mb-2 inline-flex h-6 min-w-6 items-center justify-center px-1 text-[11px] font-semibold ' + (isToday ? 'bg-blue-700 text-white' : 'text-slate-700')}>{day.getDate()}</div><div className="space-y-1.5">{loads.map(load => <Link key={load.id} href={'/sonex/loads/' + load.id} className="block border-l-2 border-blue-600 bg-blue-50 px-2 py-1.5 text-[10px] text-slate-700 hover:bg-blue-100"><p className="font-mono font-semibold text-slate-800">{load.loadNumber}</p><p className="mt-0.5 truncate">{load.pickupCity}, {load.pickupState} to {load.deliveryCity}, {load.deliveryState}</p></Link>)}{!loads.length && <p className="pt-3 text-center text-[10px] text-slate-300">No pickups</p>}</div></div>; })}</div></div>}
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Dispatch queue</h2>
                <p className="mt-0.5 text-xs text-slate-500">Open work that needs follow-through.</p>
              </div>
              <ClipboardList size={16} className="text-slate-400" />
            </div>
            <div className="divide-y divide-slate-100">
              {(data?.tasks ?? []).map(task => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => completeTask(task.id)} className="flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600" title="Mark task complete">
                    <Check size={13} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800">{task.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(task.dueAt)}{task.loadId ? ' · Load task' : ''}</p>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${task.priority === 'high' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{task.priority}</span>
                </div>
              ))}
              {!data?.tasks.length && <p className="px-4 py-8 text-center text-xs text-slate-400">No open dispatch tasks.</p>}
            </div>
          </section>

          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Add dispatch task</h2>
            </div>
            <form onSubmit={submitTask} className="space-y-3 p-4">
              <input
                value={taskTitle}
                onChange={event => setTaskTitle(event.target.value)}
                placeholder="Follow up with broker"
                className="w-full border border-slate-200 px-3 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
              <select value={taskLoadId} onChange={event => setTaskLoadId(event.target.value)} className="w-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:border-blue-500">
                <option value="">Not tied to a load</option>
                {activeLoads.map(load => <option key={load.id} value={load.id}>{load.loadNumber} · {load.brokerName}</option>)}
              </select>
              <button disabled={creatingTask || !taskTitle.trim()} className="inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {creatingTask ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create task
              </button>
            </form>
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="text-[11px] font-medium text-slate-500">Maintenance</p>
              <div className="mt-2 space-y-2">
                {(data?.maintenance ?? []).slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">{item.title}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">{formatDate(item.dueAt)}</span>
                  </div>
                ))}
                {!data?.maintenance.length && <p className="text-xs text-slate-400">No scheduled maintenance.</p>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
