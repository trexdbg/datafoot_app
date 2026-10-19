export type MatchAction = {id: string; minute: number; second: number; kind: string; outcome: string};
export type ActivityPoint = {minute: number; activity: number; gain: number; actions: number; events: MatchAction[]};
export declare const ACTIVITY_RULES: Readonly<{start: number; decay: number; pass: number; dribble: number; goal: number; floor: number}>;
export declare function actionImpact(action: MatchAction): number;
export declare function actionLabel(action: MatchAction): string;
export declare function computeActivity(events: MatchAction[], duration?: number): {timeline: ActivityPoint[]; byMinute: MatchAction[][]};
export declare function monotonePath(points: {x:number;y:number}[]): string;
