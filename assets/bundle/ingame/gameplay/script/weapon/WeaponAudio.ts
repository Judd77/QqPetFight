import type { GameplayView } from "../GameplayView";
import {
    BattleEventType, BattleStepResult, FighterGender, WeaponId,
} from "../common/GameplayTypes";

/** 武器音效：处理攻击、投掷和受击声音。 */
export class WeaponAudio {
    private lastTick = -1;
    private readonly attackWeapons: WeaponId[] = [];

    constructor(private readonly view: GameplayView) {}

    /** 清空上一场的帧去重和攻击武器记录。 */
    reset() {
        this.lastTick = -1;
        this.attackWeapons.length = 0;
    }

    /** 播放当前逻辑帧产生的武器音效。 */
    onStep(result: BattleStepResult) {
        if (result.state.tick <= this.lastTick) return;
        this.lastTick = result.state.tick;
        for (const event of result.events) {
            switch (event.type) {
                case BattleEventType.Attack: {
                    const weapon = event.weapon ?? this.view.config.battle.rules.defaultWeapon;
                    const config = this.view.config.getWeapon(weapon);
                    this.attackWeapons[event.actor] = weapon;
                    this.play(this.gender(event.actor) === FighterGender.Female
                        ? config.attackSoundFemale
                        : config.attackSoundMale);
                    break;
                }
                case BattleEventType.Throw: {
                    const weapon = event.weapon!;
                    this.attackWeapons[event.actor] = weapon;
                    this.play(this.view.config.getWeapon(weapon).throwSound);
                    break;
                }
                case BattleEventType.Skill:
                    this.attackWeapons[event.actor] = this.view.config.battle.rules.defaultWeapon;
                    break;
                case BattleEventType.Hit: {
                    const weapon = this.view.config.getWeapon(
                        this.attackWeapons[event.actor] ?? this.view.config.battle.rules.defaultWeapon,
                    );
                    this.play(this.gender(event.target!) === FighterGender.Female
                        ? weapon.hurtSoundFemale
                        : weapon.hurtSoundMale);
                    break;
                }
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
