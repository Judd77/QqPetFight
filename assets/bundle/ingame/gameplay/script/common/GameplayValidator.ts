import {
    BattleDefinitions, BattleInfo, FighterGender,
} from "./GameplayTypes";

/** 在加载资源或创建战斗前校验服务端下发的对战数据。 */
export function validateBattleInfo(info: BattleInfo, config: BattleDefinitions) {
    if (!info || !Number.isSafeInteger(info.seed) || !Array.isArray(info.fighters) || info.fighters.length !== 2) {
        throw new Error("对战数据无效");
    }
    info.fighters.forEach((fighter, index) => {
        if (fighter.id !== index || typeof fighter.name !== "string" || !fighter.name.trim() ||
            ![FighterGender.Male, FighterGender.Female].includes(fighter.gender) ||
            !Number.isSafeInteger(fighter.maxHp) || fighter.maxHp <= 0 ||
            !Number.isSafeInteger(fighter.hp) || fighter.hp <= 0 || fighter.hp > fighter.maxHp) {
            throw new Error("参战者数据无效：" + index);
        }
        if (!Array.isArray(fighter.weapons) || new Set(fighter.weapons).size !== fighter.weapons.length ||
            fighter.weapons.some((id) => id === config.rules.defaultWeapon || !config.weapons.has(id))) {
            throw new Error("武器列表无效：" + index);
        }
        if (!Array.isArray(fighter.skills) ||
            new Set(fighter.skills.map((skill) => skill.id)).size !== fighter.skills.length ||
            fighter.skills.some((skill) => !config.skills.has(skill.id) ||
                !Number.isSafeInteger(skill.power) || skill.power <= 0)) {
            throw new Error("技能列表无效：" + index);
        }
        if (fighter.portraitPath !== undefined && (!fighter.portraitPath || typeof fighter.portraitPath !== "string")) {
            throw new Error("头像路径无效：" + index);
        }
        if (fighter.npcId !== undefined && (!Number.isSafeInteger(fighter.npcId) || fighter.npcId <= 0)) {
            throw new Error("NPC 编号无效：" + index);
        }
    });
}
