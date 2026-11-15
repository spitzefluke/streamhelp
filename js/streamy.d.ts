// Typen für js/streamy.js (die Startseite in landing-yami/ ist TypeScript)
export type StreamyPose = 'front' | 'left' | 'back' | 'right' | 'top' | 'three';
export interface StreamyOptions { interactive?: boolean; auto?: boolean; pose?: 'top' | 'three' | null; yaw?: number; label?: string }
export interface Streamy { hop(): void; setPose(name: StreamyPose | null): void; destroy(): void }
export function mountStreamy(host: HTMLElement, opts?: StreamyOptions): Streamy;
