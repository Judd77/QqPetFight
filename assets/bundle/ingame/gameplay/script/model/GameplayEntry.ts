import type { BattleInfo } from "./GameplayTypes";

/** 进场来源只用于导航和结算，不参与战斗内核。 */
export enum GameplayMode {
    Pve,
    Pvp,
}

export type GameplayEntry = { battle: BattleInfo } & (
    { mode: GameplayMode.Pve; stageId: number } |
    { mode: GameplayMode.Pvp }
);
