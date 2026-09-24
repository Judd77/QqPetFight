import type { GameplayView } from "../GameplayView";
import { BattleEventType, BattleStepResult } from "../model/GameplayTypes";

/** 技能音效：只处理技能释放声音。 */
export class SkillAudio {
    private lastTick = -1;

    constructor(private readonly view: GameplayView) {}

    /** 清空上一场的帧去重状态。 */
    reset() {
        this.lastTick = -1;
    }

    /** 播放当前逻辑帧产生的技能音效。 */
    onStep(result: BattleStepResult) {
        if (result.state.tick <= this.lastTick) return;
        this.lastTick = result.state.tick;
        for (const event of result.events) {
            if (event.type !== BattleEventType.Skill) continue;
            const name = this.view.config.getSkill(event.skill!).sound;
            if (name) this.view.serve.audioService.playSound(name);
        }
    }
}
