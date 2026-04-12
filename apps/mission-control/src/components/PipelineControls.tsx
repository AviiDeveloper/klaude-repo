'use client';

import { useState } from 'react';
import { Play, Square, MapPin, Settings2 } from 'lucide-react';

interface Props {
  definitions: Array<{ id: string; name: string; enabled: boolean }>;
  isRunning: boolean;
  onTriggerRun: (definitionId: string, config?: { location?: string; verticals?: string[]; max_per_vertical?: number }) => void;
  onCancelRun: (runId: string) => void;
  activeRunId?: string;
}

export function PipelineControls({ definitions, isRunning, onTriggerRun, onCancelRun, activeRunId }: Props) {
  const [selectedDef, setSelectedDef] = useState(definitions[0]?.id ?? '');
  const [showConfig, setShowConfig] = useState(false);
  const [location, setLocation] = useState('Manchester');
  const [verticals, setVerticals] = useState('barber,cafe,restaurant,salon');
  const [maxPerVertical, setMaxPerVertical] = useState(2);

  const handleRun = () => {
    if (!selectedDef) return;
    onTriggerRun(selectedDef, showConfig ? {
      location,
      verticals: verticals.split(',').map((v) => v.trim()).filter(Boolean),
      max_per_vertical: maxPerVertical,
    } : undefined);
  };

  return (
    <div className="p-3 space-y-3">
      {/* Definition selector */}
      <select
        value={selectedDef}
        onChange={(e) => setSelectedDef(e.target.value)}
        className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded text-sm text-mc-text"
      >
        {definitions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} {!d.enabled ? '(disabled)' : ''}
          </option>
        ))}
      </select>

      {/* Config toggle */}
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="flex items-center gap-1.5 text-xs text-mc-text-secondary hover:text-mc-text"
      >
        <Settings2 className="w-3.5 h-3.5" />
        {showConfig ? 'Hide config' : 'Configure run'}
      </button>

      {/* Config panel */}
      {showConfig && (
        <div className="space-y-2 p-2 bg-mc-bg rounded border border-mc-border">
          <div>
            <label className="text-[10px] text-mc-text-secondary uppercase">Location</label>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-mc-text-secondary" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1 px-2 py-1 bg-mc-bg-tertiary border border-mc-border rounded text-xs text-mc-text"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-mc-text-secondary uppercase">Verticals (comma separated)</label>
            <input
              value={verticals}
              onChange={(e) => setVerticals(e.target.value)}
              className="w-full px-2 py-1 bg-mc-bg-tertiary border border-mc-border rounded text-xs text-mc-text"
            />
          </div>
          <div>
            <label className="text-[10px] text-mc-text-secondary uppercase">Max per vertical</label>
            <input
              type="number"
              value={maxPerVertical}
              onChange={(e) => setMaxPerVertical(Number(e.target.value))}
              min={1}
              max={10}
              className="w-full px-2 py-1 bg-mc-bg-tertiary border border-mc-border rounded text-xs text-mc-text"
            />
          </div>
        </div>
      )}

      {/* Run / Cancel buttons */}
      {isRunning ? (
        <button
          onClick={() => activeRunId && onCancelRun(activeRunId)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-mc-accent-red/20 border border-mc-accent-red text-mc-accent-red rounded font-medium text-sm hover:bg-mc-accent-red/30"
        >
          <Square className="w-4 h-4" /> Cancel Run
        </button>
      ) : (
        <button
          onClick={handleRun}
          disabled={!selectedDef}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-mc-accent-green/20 border border-mc-accent-green text-mc-accent-green rounded font-medium text-sm hover:bg-mc-accent-green/30 disabled:opacity-30"
        >
          <Play className="w-4 h-4" /> Run Pipeline
        </button>
      )}
    </div>
  );
}
