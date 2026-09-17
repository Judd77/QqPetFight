import type { BattleInfo, BattleRecording } from "./BattleTypes";
import type { BattleSession } from "./BattleSession";

/** 对战与录像状态，不保存 Cocos 节点引用。 */
export class BattleContext {
    info?: BattleInfo;
    session?: BattleSession;
    lastRecording?: BattleRecording;
    lastChecksum = "";
    replaying = false;
    completed = false;
    loading = false;

    /** 离开玩法时释放本次对战数据。 */
    reset() {
        this.info = undefined;
        this.session = undefined;
        this.lastRecording = undefined;
        this.lastChecksum = "";
        this.replaying = false;
        this.completed = false;
        this.loading = false;
    }
}
