export type MatchAction = {id: string; minute: number; second: number; kind: string; outcome: string};
export type ActivityPoint = {minute: number; activity: number | null; gain: number; actions: number; events: MatchAction[]};
export declare const ACTIVITY_RULES: Readonly<{start: number; decay: number; pass: number; dribble: number; goal: number; floor: number}>;
export declare function actionImpact(action: MatchAction): number;
export declare function actionLabel(action: MatchAction): string;
export declare function computeActivity(events: MatchAction[], duration?: number, options?: {entry?: number; exit?: number}): {timeline: ActivityPoint[]; byMinute: MatchAction[][]};
export declare function monotonePath(points: {x:number;y:number}[]): string;

export declare function smoothVisual(timeline: ActivityPoint[], sigma?: number): ActivityPoint[];
export declare function computeMatchProfiles(match: {
 duration: number;
 players: Array<{id:number;name:string;entry:number;exit:number|null}>;
 actions: Array<{p:number;m:number;s:number;k:string;o:string}>;
}): {team: Array<{minute:number;activity:number;actions:number;players:number}>;profiles:Array<{player:{id:number;name:string;entry:number;exit:number|null};actions:MatchAction[];timeline:ActivityPoint[]}>};
