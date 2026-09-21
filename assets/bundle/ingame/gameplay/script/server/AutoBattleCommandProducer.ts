import { BattleEngine } from "../battle/BattleEngine";
import type { CommandProducer } from "../battle/BattleSession";
import {
    BattleCommand, BattleCommandType, BattleIntent, BattleRandom, SkillEffect,
} from "../battle/BattleTypes";

/** 自动战斗决策；供离线 PVE 生成双方动作指令。 */
export class AutoBattleCommandProducer implements CommandProducer {
    private readonly random: BattleRandom;
    private readonly sequences = new Map<number, number>();

    constructor(seed: number) {
        this.random = new BattleRandom(seed ^ 0x9e3779b9);
    }

    create(engine: BattleEngine): BattleCommand | undefined {
        if (!engine.needsCommand) return;
        const state = engine.state;
        const fighter = state.fighters[state.activePlayer]!;
        const info = engine.info.fighters[fighter.id]!;
        const rules = engine.config.rules;
        let intent = BattleIntent.Attack;
        let entryId: number = fighter.weapon;

        if (fighter.attacks > 0) {
            const available = info.skills.filter((item) =>
                engine.config.skills.get(item.id)!.repeatable || !fighter.usedSkills.includes(item.id));
            const heal = available.find((item) => engine.config.skills.get(item.id)?.effect === SkillEffect.Heal);
            const attacks = available.filter((item) => engine.config.skills.get(item.id)?.effect === SkillEffect.Damage);
            const chosen = heal && fighter.hp / fighter.maxHp <= rules.healThreshold
                ? heal
                : attacks.length > 0 && this.random.next(100) < rules.skillChance
                    ? attacks[this.random.next(attacks.length)]
                    : undefined;
            if (chosen) {
                return this.command(fighter.id, BattleIntent.Skill, chosen.id);
            }
        }

        const attacks = info.skills.filter(item => {
            const skill = engine.config.skills.get(item.id)!;
            return skill.repeatable && skill.effect === SkillEffect.Damage;
        });
        if (attacks.length > 0) {
            return this.command(fighter.id, BattleIntent.Skill, attacks[this.random.next(attacks.length)]!.id);
        }

        if (fighter.weapon === rules.defaultWeapon && fighter.inventory.length > 0) {
            intent = BattleIntent.Equip;
            entryId = fighter.inventory[this.random.next(fighter.inventory.length)]!;
        } else if (fighter.weapon !== rules.defaultWeapon &&
            (engine.config.weapons.get(fighter.weapon)!.ranged ||
                this.random.next(100) < rules.throwChance)) {
            intent = BattleIntent.Throw;
        }
        return this.command(fighter.id, intent, entryId);
    }

    private command(player: number, intent: BattleIntent, entryId: number): BattleCommand {
        const sequence = (this.sequences.get(player) ?? 0) + 1;
        this.sequences.set(player, sequence);
        return {
            player,
            sequence,
            type: BattleCommandType.Act,
            intent,
            entryId,
        };
    }
}
