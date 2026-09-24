import type { LockstepController } from "../service/LockstepController";
import type { BattleInfo, BattleRecording } from "./GameplayTypes";

/**
 * Gameplay 各 Controller 共享的本局运行状态。
 * 这里只保存纯数据和逻辑对象，不保存 Cocos 节点引用。
 */
export class GameplayContext {
    /** 当前战斗的初始数据。 */
    info?: BattleInfo;
    /** 当前固定帧会话。 */
    lockstep?: LockstepController;
    /** 最近一场正常战斗生成的录像。 */
    lastRecording?: BattleRecording;
    /** 最近录像结束时的确定性校验值。 */
    lastChecksum = "";
    /** 当前是否正在播放录像。 */
    replaying = false;
    /** 当前会话的结束逻辑是否已经处理。 */
    completed = false;
    /** Gameplay 资源是否仍在加载。 */
    loading = false;

    /** 离开玩法时清空本次对战数据，资源缓存由资源服务继续保留。 */
    clear() {
        this.info = undefined;
        this.lockstep = undefined;
        this.lastRecording = undefined;
        this.lastChecksum = "";
        this.replaying = false;
        this.completed = false;
        this.loading = false;
    }
}
