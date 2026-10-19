export function bootMessiEncounters(): void;
export const MODE_IDS: string[];
export function rankOpponents(events: Array<{
  target_id: number; target_name: string; kind?: string; goal?: boolean;
}>, limit?: number): Array<{id: number; name: string; count: number; goals: number}>;
