import type { BattleInfo } from "./BattleTypes";

/** 进场来源只用于导航和结算，不参与战斗内核。 */
export enum BattleMode {
    Pve,
    Pvp,
}

export type BattleEntry = { battle: BattleInfo } & (
    { mode: BattleMode.Pve; stageId: number } |
    { mode: BattleMode.Pvp }
);
