import { BattleInfo, FighterGender, MAX_HP, SkillId, WeaponId, WEAPONS, SKILLS } from "./BattleTypes";

/** 仅供单机 Demo 的接口替身，不宣称实现了原版服务器的配装或数值规则。 */
export class MockBattleServer {
    private sequence = 0;

    /** 模拟一次独立响应；武器数量、顺序和双方属性均来自返回数据。 */
    async requestBattle(): Promise<BattleInfo> {
        return createDemoBattle(20260915 + this.sequence++);
    }
}

/** 固定测试样本与浏览器 Demo 共用同一份初始数据。 */
export function createDemoBattle(seed: number): BattleInfo {
    return {
        id: "demo-" + seed,
        seed,
        fighters: [
            { id: 0, name: "少侠", gender: FighterGender.Male, hp: MAX_HP, maxHp: MAX_HP, weapons: [WeaponId.Dagger, WeaponId.Spear, WeaponId.FlyingKnife], skills: [{ id: SkillId.MineralWater, power: 60 }, { id: SkillId.ShadowlessKick, power: 44 }] },
            { id: 1, name: "对手", gender: FighterGender.Female, hp: MAX_HP, maxHp: MAX_HP, weapons: [WeaponId.Spear, WeaponId.FlyingKnife], skills: [{ id: SkillId.MineralWater, power: 60 }, { id: SkillId.PenguinRoar, power: 48 }] },
        ],
    };
}

/** 在加载资源前检查模拟响应，避免半场景、无效资源或非法血量进入战斗。 */
export function validateBattleInfo(info: BattleInfo) {
    if (!info || !Number.isSafeInteger(info.seed) || !Array.isArray(info.fighters) || info.fighters.length !== 2) {
        throw new Error("对战数据无效");
    }
    info.fighters.forEach((fighter, index) => {
        if (fighter.id !== index || typeof fighter.name !== "string" || !fighter.name.trim() ||
            ![FighterGender.Male, FighterGender.Female].includes(fighter.gender) || !Number.isSafeInteger(fighter.maxHp) || fighter.maxHp <= 0 ||
            !Number.isSafeInteger(fighter.hp) || fighter.hp <= 0 || fighter.hp > fighter.maxHp) {
            throw new Error("参战者数据无效：" + index);
        }
        if (!Array.isArray(fighter.weapons) || new Set(fighter.weapons).size !== fighter.weapons.length ||
            fighter.weapons.some((id) => id === WeaponId.Fist || !WEAPONS[id])) {
            throw new Error("武器列表无效：" + index);
        }
        if (!Array.isArray(fighter.skills) || new Set(fighter.skills.map((skill) => skill.id)).size !== fighter.skills.length ||
            fighter.skills.some((skill) => !SKILLS[skill.id] || skill.id === SkillId.None || !Number.isSafeInteger(skill.power) || skill.power <= 0)) {
            throw new Error("技能列表无效：" + index);
        }
    });
}
