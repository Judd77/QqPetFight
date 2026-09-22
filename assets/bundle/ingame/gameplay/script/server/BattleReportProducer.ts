import { BattleEngine } from "../battle/BattleEngine";
import type { CommandProducer } from "../battle/BattleSession";
import {
    BattleAttackType, BattleCommand, BattleCommandType, BattleDefinitions, BattleInfo, BattleIntent,
    BattleRandom, BattleReaction, BattleReport, SkillEffect, SkillId, WeaponId,
} from "../battle/BattleTypes";

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
export class BattleReportProducer implements CommandProducer {
    private readonly report: BattleReport;
    private index = 0;

    constructor(info: BattleInfo, config: BattleDefinitions) {
        this.report = this.generate(info, config);
    }

    create(engine: BattleEngine): BattleCommand | undefined {
        if (!engine.needsCommand) return;
        const action = this.report.actions[this.index++];
        return action ? this.cloneAction(action) : undefined;
    }

    private generate(info: BattleInfo, config: BattleDefinitions): BattleReport {
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
            const command = this.createAction(
                info,
                config,
                fighters,
                sequences,
                random,
                player,
                actions.length + 1,
            );
            actions.push(command);
        }

        return { version: 1, battleId: info.id, actions };
    }

    private createAction(
        info: BattleInfo,
        config: BattleDefinitions,
        fighters: ReportFighterState[],
        sequences: number[],
        random: BattleRandom,
        player: number,
        round: number,
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
            const restored = Math.min(healing, fighterInfo.maxHp - fighter.hp);
            fighter.hp += restored;
            resolution = {
                target: player,
                reaction: BattleReaction.None,
                damage: 0,
                healing: restored,
                critical: false,
            };
        } else {
            resolution = this.resolveDamage(fighters, random, rules, target, power);
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

    private resolveDamage(
        fighters: ReportFighterState[],
        random: BattleRandom,
        rules: BattleDefinitions["rules"],
        target: number,
        baseDamage: number,
    ) {
        if (random.next(100) < rules.dodgeChance) {
            return { target, reaction: BattleReaction.Dodge, damage: 0, healing: 0, critical: false };
        }
        const critical = random.next(100) < rules.criticalChance;
        const variance = rules.damageVariance;
        const damage = Math.max(1, Math.floor(
            (baseDamage + random.next(variance * 2 + 1) - variance) * (critical ? rules.criticalMultiplier : 1),
        ));
        fighters[target]!.hp = Math.max(0, fighters[target]!.hp - damage);
        return { target, reaction: BattleReaction.Hit, damage, healing: 0, critical };
    }

    private cloneAction(action: BattleCommand): BattleCommand {
        return { ...action, resolution: { ...action.resolution } };
    }
}
