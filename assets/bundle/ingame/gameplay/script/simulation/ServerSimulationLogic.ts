import {
    BattleAttackType, BattleCommand, BattleCommandType, BattleDefinitions, BattleInfo, BattleIntent,
    BattleRandom, BattleReaction, BattleReport, SkillEffect, SkillId, WeaponId,
} from "../model/GameplayTypes";
import type { StatsController } from "../stats/StatsController";

interface ReportFighterState {
    hp: number;
    weapon: WeaponId;
    inventory: WeaponId[];
    usedSkills: SkillId[];
    attacks: number;
}

/**
 * 本地服务端战报适配器。
 * 随机选择、命中和伤害全部在战斗开始前结算；客户端内核只消费已结算动作。
 */
export class ServerSimulationLogic {
    /**
     * 根据战斗初始数据一次性生成已结算战报。
     * 相同配置和 seed 必须生成完全相同的指令顺序与结算结果。
     */
    generateReport(info: BattleInfo, config: BattleDefinitions, stats: StatsController): BattleReport {
        const rules = config.rules;
        const random = new BattleRandom(info.seed ^ 0x9e3779b9);
        const fighters: ReportFighterState[] = info.fighters.map((fighter) => ({
            hp: fighter.hp,
            weapon: rules.defaultWeapon,
            inventory: fighter.weapons.slice(),
            usedSkills: [],
            attacks: 0,
        }));
        const sequences = info.fighters.map(() => 0);
        const actions: BattleCommand[] = [];

        while (fighters.every((fighter) => fighter.hp > 0) && actions.length < rules.maxFrames) {
            const player = random.next(fighters.length);
            const command = this.createResolvedCommand(
                info,
                config,
                fighters,
                sequences,
                random,
                player,
                actions.length + 1,
                stats,
            );
            actions.push(command);
        }

        return { version: 1, battleId: info.id, actions };
    }

    /**
     * 创建一条已确定武器、技能、命中与伤害结果的服务端行动。
     * 此方法只修改战报生成阶段的临时状态，不接触客户端 CommandController。
     */
    private createResolvedCommand(
        info: BattleInfo,
        config: BattleDefinitions,
        fighters: ReportFighterState[],
        sequences: number[],
        random: BattleRandom,
        player: number,
        round: number,
        stats: StatsController,
    ): BattleCommand {
        const rules = config.rules;
        const fighter = fighters[player]!;
        const fighterInfo = info.fighters[player]!;
        const target = 1 - player;
        let intent = BattleIntent.Attack;
        let entryId = fighter.weapon;
        let attackType = BattleAttackType.Normal;
        let power = config.weapons.get(fighter.weapon)!.damage;
        let healing = 0;

        if (fighter.attacks > 0) {
            const available = fighterInfo.skills.filter((item) => {
                const skill = config.skills.get(item.id)!;
                return skill.repeatable || !fighter.usedSkills.includes(item.id);
            });
            const heal = available.find((item) => config.skills.get(item.id)!.effect === SkillEffect.Heal);
            const attacks = available.filter((item) => config.skills.get(item.id)!.effect === SkillEffect.Damage);
            const skill = heal && fighter.hp / fighterInfo.maxHp <= rules.healThreshold
                ? heal
                : attacks.length > 0 && random.next(100) < rules.skillChance
                    ? attacks[random.next(attacks.length)]
                    : undefined;
            if (skill) {
                intent = BattleIntent.Skill;
                entryId = skill.id;
                power = skill.power;
                attackType = BattleAttackType.None;
                if (!config.skills.get(skill.id)!.repeatable) fighter.usedSkills.push(skill.id);
                if (config.skills.get(skill.id)!.effect === SkillEffect.Heal) healing = power;
            }
        }

        if (intent !== BattleIntent.Skill) {
            const repeatable = fighterInfo.skills.filter((item) => {
                const skill = config.skills.get(item.id)!;
                return skill.repeatable && skill.effect === SkillEffect.Damage;
            });
            if (repeatable.length > 0) {
                const skill = repeatable[random.next(repeatable.length)]!;
                intent = BattleIntent.Skill;
                entryId = skill.id;
                power = skill.power;
                attackType = BattleAttackType.None;
            } else if (fighter.weapon === rules.defaultWeapon && fighter.inventory.length > 0) {
                intent = BattleIntent.Equip;
                entryId = fighter.inventory.splice(random.next(fighter.inventory.length), 1)[0]!;
                fighter.weapon = entryId;
                const weapon = config.weapons.get(entryId)!;
                power = weapon.damage;
                attackType = weapon.ranged ? BattleAttackType.Throw : BattleAttackType.Normal;
                if (weapon.ranged) fighter.weapon = rules.defaultWeapon;
            } else if (fighter.weapon !== rules.defaultWeapon &&
                (config.weapons.get(fighter.weapon)!.ranged || random.next(100) < rules.throwChance)) {
                intent = BattleIntent.Throw;
                entryId = fighter.weapon;
                power = config.weapons.get(entryId)!.damage;
                attackType = BattleAttackType.Throw;
                fighter.weapon = rules.defaultWeapon;
            }
        }

        fighter.attacks++;
        let resolution;
        if (healing > 0) {
            const restored = stats.calculateHealing(fighter.hp, fighterInfo.maxHp, healing);
            fighter.hp += restored;
            resolution = {
                target: player,
                reaction: BattleReaction.None,
                damage: 0,
                healing: restored,
                critical: false,
            };
        } else {
            resolution = stats.calculateDamage(target, power, random, rules);
            fighters[target]!.hp = Math.max(0, fighters[target]!.hp - resolution.damage);
        }
        return {
            player,
            sequence: ++sequences[player]!,
            type: BattleCommandType.Act,
            round,
            intent,
            entryId,
            attackType,
            counter: false,
            comboIndex: 0,
            resolution,
        };
    }

}
