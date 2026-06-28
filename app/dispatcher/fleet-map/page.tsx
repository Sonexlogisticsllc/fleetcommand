'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Driver } from '@/lib/types';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { MapPin, Truck, Navigation, Radio } from 'lucide-react';

// Driver locations for the map markers
const DRIVER_MARKERS = [
  { id: 'drv-001', name: 'Marcus Johnson', truck: 'FC-101', status: 'driving', lat: 30.2672, lng: -97.7431, city: 'Austin, TX' },
  { id: 'drv-002', name: 'Sandra Rivera', truck: 'FC-102', status: 'on_duty', lat: 43.6532, lng: -89.7009, city: 'Madison, WI' },
  { id: 'drv-003', name: 'James Whitfield', truck: 'FC-103', status: 'off_duty', lat: 44.9778, lng: -93.2650, city: 'Minneapolis, MN' },
  { id: 'drv-004', name: 'Priya Patel', truck: 'FC-104', status: 'sleeper', lat: 32.7767, lng: -96.7970, city: 'Dallas, TX' },
];

const STATUS_COLORS: Record<string, string> = {
  driving: '#10B981',
  on_duty: '#F59E0B',
  off_duty: '#64748B',
  sleeper: '#3B82F6',
};

export default function FleetMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selected, setSelected] = useState<typeof DRIVER_MARKERS[0] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    fetch('/api/drivers').then(r => r.json()).then(setDrivers);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let mapboxgl: any;
    import('mapbox-gl').then((mod) => {
      mapboxgl = mod.default;
      // Use Mapbox token from environment variables
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

      try {
        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-95.7, 37.1],
          zoom: 4,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('load', () => {
          setMapLoaded(true);

          // Add driver markers
          DRIVER_MARKERS.forEach((driver) => {
            const el = document.createElement('div');
            el.className = 'driver-marker';
            el.style.cssText = `
              width: 36px; height: 36px; border-radius: 50%;
              background: ${STATUS_COLORS[driver.status]};
              border: 3px solid rgba(255,255,255,0.3);
              display: flex; align-items: center; justify-content: center;
              cursor: pointer; font-size: 12px; font-weight: 700; color: white;
              box-shadow: 0 0 16px ${STATUS_COLORS[driver.status]}60;
              transition: transform 0.2s;
            `;
            el.innerHTML = `<span>${driver.truck.split('-')[1]}</span>`;
            el.onmouseenter = () => { el.style.transform = 'scale(1.2)'; };
            el.onmouseleave = () => { el.style.transform = 'scale(1)'; };
            el.onclick = () => setSelected(driver);

            new mapboxgl.Marker({ element: el })
              .setLngLat([driver.lng, driver.lat])
              .addTo(map);
          });
        });

        map.on('error', () => setMapError(true));
      } catch {
        setMapError(true);
      }
    }).catch(() => setMapError(true));

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6 animate-fade-in">
      {/* Driver List Panel */}
      <div className="w-72 flex-shrink-0 bg-navy-panel border-r border-navy-border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-navy-border">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-amber animate-pulse" />
            <span className="text-sm font-bold text-white">Live Fleet</span>
            <span className="ml-auto text-xs bg-success/15 text-success border border-success/25 px-2 py-0.5 rounded-full">
              {DRIVER_MARKERS.filter(d => d.status === 'driving').length} Moving
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {DRIVER_MARKERS.map(driver => (
            <div
              key={driver.id}
              onClick={() => {
                setSelected(driver);
                mapRef.current?.flyTo({ center: [driver.lng, driver.lat], zoom: 8, duration: 1500 });
              }}
              className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                selected?.id === driver.id
                  ? 'border-amber/40 bg-amber/5'
                  : 'border-navy-border hover:border-navy-border/80 hover:bg-navy-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: STATUS_COLORS[driver.status], boxShadow: `0 0 10px ${STATUS_COLORS[driver.status]}40` }}
                >
                  {driver.truck.split('-')[1]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{driver.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />{driver.city}
                  </div>
                </div>
                <StatusBadge status={driver.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Selected Driver Detail */}
        {selected && (
          <div className="p-4 border-t border-navy-border bg-navy-DEFAULT animate-slide-in-up">
            <div className="text-xs font-bold text-amber uppercase tracking-wider mb-3">
              {selected.truck} — Live Detail
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between"><span className="text-slate-500">Driver</span>{selected.name}</div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span>
                <StatusBadge status={selected.status} />
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Location</span>{selected.city}</div>
              <div className="flex justify-between"><span className="text-slate-500">Coords</span>
                <span className="font-mono">{selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />

        {!mapLoaded && !mapError && (
          <div className="absolute inset-0 bg-navy flex items-center justify-center">
            <Spinner size={24} text="Loading Mapbox Dark Map..." />
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 bg-navy flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">🗺️</div>
            <div className="text-white font-semibold">Map requires a valid Mapbox token</div>
            <div className="text-slate-400 text-sm text-center max-w-sm">
              Set <code className="text-amber bg-navy-panel px-1.5 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your <code className="text-amber bg-navy-panel px-1.5 py-0.5 rounded">.env.local</code> to render the dark-v11 fleet map.
            </div>
            {/* Simulated map overlay */}
            <div className="mt-4 bg-navy-panel border border-navy-border rounded-xl p-6 space-y-3 w-80">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Simulated Fleet Positions</div>
              {DRIVER_MARKERS.map(d => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[d.status] }} />
                  <span className="text-sm text-white">{d.truck}</span>
                  <span className="text-xs text-slate-400 flex-1">{d.city}</span>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map overlay legend */}
        {mapLoaded && (
          <div className="absolute bottom-6 right-6 glass-card p-4 shadow-glass animate-fade-in">
            <div className="text-xs font-bold text-white mb-3 uppercase tracking-wider">Driver Status</div>
            <div className="space-y-2">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="text-slate-300 capitalize">{status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
