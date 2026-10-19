export type PulseRole='attack'|'midfield'|'defense'|'goalkeeper';
export interface PulseScoreRow {key:string;label:string;points:Readonly<Record<PulseRole,number>>;note:string}
export declare const PULSE_ROLES:ReadonlyArray<{key:PulseRole;label:string;short:string}>;
export declare const PULSE_SCORE_ROWS:ReadonlyArray<PulseScoreRow>;
export declare function pulseRole(position?:string):PulseRole;
export declare function pulseRoleLabel(position?:string):string;
export declare function pulsePoints(key:string,role?:PulseRole):number;
