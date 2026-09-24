import type { GameplayView } from "../GameplayView";
import {
    BattleEventType, BattleStepResult, FighterGender,
} from "../common/GameplayTypes";

/** 角色音效：处理移动、闪避和战败语音。 */
export class RoleAudio {
    private lastTick = -1;

    constructor(private readonly view: GameplayView) {}

    /** 清空上一场的帧去重状态。 */
    reset() {
        this.lastTick = -1;
    }

    /** 播放当前逻辑帧产生的角色音效。 */
    onStep(result: BattleStepResult) {
        if (result.state.tick <= this.lastTick) return;
        this.lastTick = result.state.tick;
        for (const event of result.events) {
            switch (event.type) {
                case BattleEventType.Move:
                    this.play(this.view.config.view.runSound);
                    break;
                case BattleEventType.Dodge:
                    this.play(this.view.config.view.dodgeSound);
                    break;
                case BattleEventType.Finish:
                    if (result.state.winner >= 0) {
                        this.play(this.gender(1 - result.state.winner) === FighterGender.Female
                            ? this.view.config.view.femaleLoseSound
                            : this.view.config.view.maleLoseSound);
                    }
                    break;
            }
        }
    }

    /** 获取本局角色性别。 */
    private gender(player: number) {
        return this.view.context.info!.fighters[player]!.gender;
    }

    /** 忽略未配置的空音效名。 */
    private play(name: string) {
        if (name) this.view.serve.audioService.playSound(name);
    }
}
