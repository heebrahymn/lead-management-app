import { useState, useMemo } from "react";
import { PeriodFilter } from "@/lib/wati";

export type PresetKey = '7' | '14' | '30' | 'all' | 'custom';

export function useDateFilter(defaultPreset: PresetKey = '30') {
  const [preset, setPreset] = useState<PresetKey>(defaultPreset);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const filter = useMemo((): PeriodFilter | undefined => {
    if (preset === 'all') return undefined;
    
    const now = new Date();
    if (preset === 'custom') {
      if (!customStart || !customEnd) return undefined;
      return {
        currentStart: new Date(customStart + 'T00:00:00Z'),
        currentEnd: new Date(customEnd + 'T23:59:59Z'),
      };
    }
    const days = parseInt(preset, 10);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return {
      currentStart: new Date(start.getTime() - days * 24 * 60 * 60 * 1000),
      currentEnd: now,
    };
  }, [preset, customStart, customEnd]);

  return {
    preset,
    setPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    filter,
  };
}
