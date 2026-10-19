export type MatchAction = {id?: string; minute: number; second: number; kind: string; outcome: string; playerId?: number};
export type ActivityPoint = {minute: number; activity: number | null; gain: number; actions: number; events: MatchAction[]};
export type PulsePoint = {minute:number;activity:number|null;impact:number|null;gain:number;impactGain:number;actions:number;events:MatchAction[]};
export declare const PULSE_RULES: Readonly<{shortHalfLife:number;longHalfLife:number;shortMix:number;activityScale:number;impactScale:number}>;
export declare function pulseWeight(action:Pick<MatchAction,'kind'|'outcome'>):{activity:number;impact:number};
export declare function computePulse(events:MatchAction[],duration?:number,options?:{entry?:number;exit?:number}):{timeline:PulsePoint[];byMinute:MatchAction[][]};
export declare const ACTIVITY_RULES: Readonly<{start: number; decay: number; pass: number; dribble: number; goal: number; floor: number}>;
export declare function actionImpact(action: Pick<MatchAction, 'kind' | 'outcome'>): number;
export declare function actionLabel(action: Pick<MatchAction, 'kind' | 'outcome'>): string;
export declare function computeActivity(events: MatchAction[], duration?: number, options?: {entry?: number; exit?: number}): {timeline: ActivityPoint[]; byMinute: MatchAction[][]};
export declare function monotonePath(points: {x:number;y:number}[]): string;

export declare function smoothVisual<T extends {minute:number;activity:number|null}>(timeline: T[], sigma?: number): T[];
export declare function computeMatchProfiles(match: {
 duration: number;
 players: Array<{id:number;name:string;entry:number;exit:number|null}>;
 actions: Array<{p:number;m:number;s:number;k:string;o:string}>;
}): {team: Array<{minute:number;activity:number;impact:number;actions:number;players:number}>;profiles:Array<{player:{id:number;name:string;entry:number;exit:number|null};actions:MatchAction[];timeline:PulsePoint[]}>};
