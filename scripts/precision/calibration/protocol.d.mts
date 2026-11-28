export const PHASES: readonly ['calibration', 'reserve', 'live', 'calibration-run2', 'reserve-run2', 'calibration-run3', 'reserve-run3'];
export type Phase = typeof PHASES[number];
export function runOf(phase: Phase): 1 | 2 | 3;
export const FROZEN_PROTOCOL_SHA256: string;
export const RUN2_PROTOCOL_SHA256: string;
export const RUN3_PROTOCOL_SHA256: string | null;
