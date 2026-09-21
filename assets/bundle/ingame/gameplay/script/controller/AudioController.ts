import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import {
    BattleEventType, BattleStepResult, FighterGender, WeaponId,
} from "../battle/BattleTypes";

/** 只把逻辑事件映射为配置音效，不扫描动画状态、不参与战斗计算。 */
export class AudioController extends BaseController<GameplayView> {
    private lastTick = -1;
    private readonly attackWeapons: WeaponId[] = [];

    reset() {
        this.lastTick = -1;
        this.attackWeapons.length = 0;
        this.play(this.view.config.view.countdownSound);
    }

    onStep(result: BattleStepResult) {
        if (result.state.tick <= this.lastTick) return;
        this.lastTick = result.state.tick;
        for (const event of result.events) {
            switch (event.type) {
                case BattleEventType.Countdown:
                    this.play(this.view.config.view.countdownSound);
                    break;
                case BattleEventType.Start:
                    this.play(this.view.config.view.startSound);
                    break;
                case BattleEventType.Move:
                    this.play(this.view.config.view.runSound);
                    break;
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
                    this.play(this.view.config.getSkill(event.skill!).sound);
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

    private gender(player: number) {
        return this.view.context.info!.fighters[player]!.gender;
    }

    private play(name: string) {
        if (name) this.view.serve.audioService.playSound(name);
    }
}
