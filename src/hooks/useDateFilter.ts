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
        currentStart: new Date(customStart + 'T00:00:00'),
        currentEnd: new Date(customEnd + 'T23:59:59'),
      };
    }
    const days = parseInt(preset, 10);
    return {
      currentStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
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
