import type { GameplayView } from "../GameplayView";
import { BattleEventType, BattleStepResult } from "../model/GameplayTypes";

/** 流程音效：只处理倒计时与开战提示。 */
export class ProcessAudio {
    private lastTick = -1;

    constructor(private readonly view: GameplayView) {}

    /** 重置帧去重状态，并播放进入准备阶段的首个倒计时音效。 */
    reset() {
        this.lastTick = -1;
        this.play(this.view.config.view.countdownSound);
    }

    /** 播放当前逻辑帧产生的流程音效。 */
    onStep(result: BattleStepResult) {
        if (result.state.tick <= this.lastTick) return;
        this.lastTick = result.state.tick;
        for (const event of result.events) {
            if (event.type === BattleEventType.Countdown) this.play(this.view.config.view.countdownSound);
            else if (event.type === BattleEventType.Start) this.play(this.view.config.view.startSound);
        }
    }

    /** 忽略未配置的空音效名。 */
    private play(name: string) {
        if (name) this.view.serve.audioService.playSound(name);
    }
}
