import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleWorld } from "../battle/BattleWorld";
import { BattleEventType, BattlePhase, COUNTDOWN_FRAMES, FighterAction, FighterGender, FRAME_RATE, SkillId, WeaponId } from "../battle/BattleTypes";

const SKILL_SOUNDS: Partial<Record<SkillId, string>> = {
    [SkillId.MineralWater]: "KuangQuanShui",
    [SkillId.ShadowlessKick]: "FoShanWuYingJiao",
    [SkillId.PenguinRoar]: "QiEHou",
};

/** 只消费战斗事件播放原版音效，不参与逻辑计算或修改用户音量。 */
export class AudioController extends BaseController<GameplayView> {
    private lastTick = -1;
    private readonly hurtSounds: string[] = [];

    /** 新局与回放都重新开始倒计时，不继承上一局的受击声音。 */
    reset() {
        this.lastTick = -1;
        this.hurtSounds.length = 0;
        this.play("NumSound");
    }

    /** 按逻辑帧消费一次；投掷命中仍使用脱手前的武器受击声。 */
    onFrame(world: BattleWorld) {
        if (world.tick <= this.lastTick) return;
        this.lastTick = world.tick;
        if (world.phase === BattlePhase.Countdown && world.tick > 0 && world.tick % FRAME_RATE === 0) {
            this.play("NumSound");
        }
        if (world.tick === COUNTDOWN_FRAMES) this.play("StartReady");
        for (const fighter of world.fighters) {
            if (fighter.action === FighterAction.Run && fighter.actionFrame === world.tick) this.play("RunTo");
        }
        for (const event of world.events) {
            const prefix = this.getVoicePrefix(event.actor);
            switch (event.type) {
                case BattleEventType.Attack:
                case BattleEventType.Throw: {
                    const weapon = event.weapon ?? WeaponId.Fist;
                    // 官网配置：短剑、红缨枪的攻击/投掷音效均为 Small，不能按武器体型猜。
                    this.play(event.type === BattleEventType.Throw ? "ThrowSmall"
                        : weapon === WeaponId.Fist ? prefix + "KongShou" : "CommonSmall");
                    this.hurtSounds[event.actor] = this.getVoicePrefix(1 - event.actor) + "ShouShang"
                        + (weapon === WeaponId.Fist ? "" : "Dao");
                    break;
                }
                case BattleEventType.Skill:
                    this.play(SKILL_SOUNDS[event.skill!]);
                    this.hurtSounds[event.actor] = this.getVoicePrefix(1 - event.actor) + "ShouShang";
                    break;
                case BattleEventType.Hit:
                    this.play(this.hurtSounds[event.actor]);
                    break;
                case BattleEventType.Dodge:
                    this.play("ShanDuo");
                    break;
                case BattleEventType.Finish:
                    if (world.winner >= 0) this.play(this.getVoicePrefix(1 - world.winner) + "Lose");
                    break;
            }
        }
    }

    /** 从参战者数据选择男女配音，不依赖左右站位。 */
    private getVoicePrefix(player: number) {
        return this.view.context.info?.fighters[player]?.gender === FighterGender.Female ? "MM" : "GG";
    }

    /** 保留框架已有的静音与音量设置。 */
    private play(name: string | undefined) {
        if (name) this.view.serve.audioService.playSound(name);
    }

}
