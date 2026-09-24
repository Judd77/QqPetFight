import {
    BattleDefinitions, BattleRandom, BattleReaction, BattleResolution,
} from "../common/GameplayTypes";

/** 数值计算服务；只执行确定性公式，不保存任何战斗状态。 */
export class StatsController {
    /** 根据闪避、暴击和伤害浮动规则生成一次伤害结算。 */
    calculateDamage(
        target: number,
        baseDamage: number,
        random: BattleRandom,
        rules: BattleDefinitions["rules"],
    ): BattleResolution {
        if (random.next(100) < rules.dodgeChance) {
            return { target, reaction: BattleReaction.Dodge, damage: 0, healing: 0, critical: false };
        }
        const critical = random.next(100) < rules.criticalChance;
        const variance = rules.damageVariance;
        const damage = Math.max(1, Math.floor(
            (baseDamage + random.next(variance * 2 + 1) - variance) * (critical ? rules.criticalMultiplier : 1),
        ));
        return { target, reaction: BattleReaction.Hit, damage, healing: 0, critical };
    }

    /** 计算不超过最大生命值的实际治疗量。 */
    calculateHealing(currentHp: number, maxHp: number, power: number) {
        return Math.min(power, maxHp - currentHp);
    }
}
