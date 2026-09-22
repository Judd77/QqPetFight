import type { Schema } from "db://assets/bundle/shared/script/schema/Schema";
import {
    AnimationId, BattleDefinitions, BattlePhase, BattleRules, FighterAction, FighterGender, FighterInfo, FighterState, SkillDefinition,
    SkillEffect, SkillId, WeaponDefinition, WeaponId,
} from "../battle/BattleTypes";

/** 玩家和 NPC 共用序列帧播放器，来源表各自描述动作选择。 */
export type RoleAnimation = Pick<Schema.RoleAnimationEntry,
    "id" | "assetPath" | "fps" | "loop" | "offsetX" | "offsetY"> & { facing?: number };

function animationKey(gender: FighterGender, weapon: WeaponId, animation: AnimationId) {
    return gender + ":" + weapon + ":" + animation;
}

/** 将 Luban 生成表收口为玩法使用的只读配置，战斗内核不直接依赖生成代码。 */
export class GameplayConfig {
    declare battle: BattleDefinitions;
    declare view: Schema.BattleViewEntry;
    private readonly animations = new Map<string, Schema.RoleAnimationEntry>();
    private readonly frames = new Map<string, Schema.RoleFrameEntry[]>();
    private readonly actionAnimations = new Map<FighterAction, AnimationId>();
    private readonly npcAnimations = new Map<string, Schema.NpcAnimationEntry>();

    load(tables: Schema.Tables) {
        const rule = tables.TbBattleRule.get(1);
        const view = tables.TbBattleView.get(1);
        if (!rule || !view) throw new Error("缺少战斗基础配置");
        this.view = view;

        const weapons = new Map<WeaponId, WeaponDefinition>();
        for (const row of tables.TbWeapon.getDataList()) {
            const id = row.id as WeaponId;
            if (weapons.has(id)) throw new Error("武器配置重复：" + row.id);
            weapons.set(id, { ...row, id, attackAnimation: row.attackAnimation });
        }
        const skills = new Map<SkillId, SkillDefinition>();
        for (const row of tables.TbSkill.getDataList()) {
            const id = row.id as SkillId;
            if (skills.has(id)) throw new Error("技能配置重复：" + row.id);
            skills.set(id, { ...row, id, effect: row.effect as SkillEffect, animation: row.animation });
        }
        const rules: BattleRules = { ...rule, defaultWeapon: rule.defaultWeapon as WeaponId };
        this.battle = { rules, weapons, skills };
        this.validateBattleDefinitions();

        this.actionAnimations.clear();
        for (const row of tables.TbFighterAction.getDataList()) {
            if (row.animation >= 0) this.actionAnimations.set(row.id as FighterAction, row.animation);
        }
        this.animations.clear();
        for (const row of tables.TbRoleAnimation.getDataList()) {
            const key = animationKey(row.gender as FighterGender, row.weapon, row.animation);
            if (this.animations.has(key)) throw new Error("角色动作语义重复：" + key);
            this.animations.set(key, row);
        }
        this.npcAnimations.clear();
        for (const row of tables.TbNpcAnimation.getDataList()) {
            const key = this.npcAnimationKey(row.npcId, row.phase, row.action, row.skillId);
            if (this.npcAnimations.has(key)) throw new Error("NPC 动作配置重复：" + key);
            if (row.fps <= 0 || (row.facing !== 1 && row.facing !== -1)) throw new Error("NPC 动画参数无效：" + row.id);
            this.npcAnimations.set(key, row);
        }
        this.frames.clear();
        for (const row of tables.TbRoleFrame.getDataList()) {
            let rows = this.frames.get(row.clipId);
            if (!rows) this.frames.set(row.clipId, rows = []);
            if (rows[row.index]) throw new Error("角色帧重复：" + row.clipId + ":" + row.index);
            rows[row.index] = row;
        }
    }

    getWeapon(id: WeaponId) {
        const value = this.battle.weapons.get(id);
        if (!value) throw new Error("缺少武器配置：" + id);
        return value;
    }

    getSkill(id: SkillId) {
        const value = this.battle.skills.get(id);
        if (!value) throw new Error("缺少技能配置：" + id);
        return value;
    }

    getAnimation(gender: FighterGender, weapon: WeaponId, animation: AnimationId) {
        const value = this.animations.get(animationKey(gender, weapon, animation));
        if (!value) throw new Error("缺少角色动作配置：" + gender + ":" + weapon + ":" + animation);
        return value;
    }

    getAnimationForAction(gender: FighterGender, weapon: WeaponId, action: FighterAction, skill?: SkillId) {
        if (action === FighterAction.Skill && skill === undefined) throw new Error("技能动作缺少技能 ID");
        const animation = action === FighterAction.Attack
            ? this.getWeapon(weapon).attackAnimation
            : action === FighterAction.Skill
                ? this.getSkill(skill!).animation
                : this.actionAnimations.get(action);
        if (animation === undefined) throw new Error("缺少逻辑动作映射：" + action);
        return this.getAnimation(gender, weapon, animation);
    }

    getFrames(clipId: string): readonly Schema.RoleFrameEntry[] {
        const rows = this.frames.get(clipId);
        if (!rows?.length) throw new Error("缺少角色帧配置：" + clipId);
        for (let index = 0; index < rows.length; index++) {
            if (!rows[index]) throw new Error("角色帧不连续：" + clipId + ":" + index);
        }
        return rows;
    }

    /** NPC 严格使用本体动作，缺少配置时在准备阶段暴露错误。 */
    getFighterAnimation(info: FighterInfo, fighter: FighterState, phase: BattlePhase): RoleAnimation {
        if (info.npcId === undefined) {
            return this.getAnimationForAction(info.gender, fighter.actionWeapon, fighter.action, fighter.skill);
        }
        const skill = fighter.action === FighterAction.Skill ? fighter.skill! : 0;
        const key = this.npcAnimationKey(info.npcId, phase, fighter.action, skill);
        const row = this.npcAnimations.get(key);
        if (!row) throw new Error("缺少 NPC 动作配置：" + key);
        return row;
    }

    private npcAnimationKey(npcId: number, phase: number, action: number, skill: number) {
        return npcId + ":" + phase + ":" + action + ":" + skill;
    }

    /** 只准备本场参战者按配装可播放的动作，不按角色目录整批加载。 */
    getRequiredAnimations(info: { fighters: readonly {
        gender: FighterGender;
        weapons: readonly WeaponId[];
        npcId?: number;
        skills: readonly { id: SkillId }[];
    }[] }) {
        const result = new Map<string, RoleAnimation>();
        for (const fighter of info.fighters) {
            if (fighter.npcId !== undefined) {
                const required = [
                    [BattlePhase.Countdown, FighterAction.Idle, 0],
                    [BattlePhase.Fighting, FighterAction.Idle, 0],
                    [BattlePhase.Fighting, FighterAction.Hurt, 0],
                    [BattlePhase.Fighting, FighterAction.Dodge, 0],
                    [BattlePhase.Finished, FighterAction.Victory, 0],
                    [BattlePhase.Finished, FighterAction.Dead, 0],
                    ...fighter.skills.map(skill => [BattlePhase.Fighting, FighterAction.Skill, skill.id]),
                ];
                for (const [phase, action, skill] of required) {
                    const key = this.npcAnimationKey(fighter.npcId, phase!, action!, skill!);
                    const row = this.npcAnimations.get(key);
                    if (!row) throw new Error("NPC 缺少完整动作：" + key);
                    this.getFrames(row.id);
                    result.set(row.id, row);
                }
                continue;
            }
            const weapons = new Set<WeaponId>([this.battle.rules.defaultWeapon, ...fighter.weapons]);
            const skills = fighter.skills.map(skill => this.getSkill(skill.id));
            for (const weaponId of weapons) {
                const weapon = this.getWeapon(weaponId);
                const armed = weaponId !== this.battle.rules.defaultWeapon;
                const add = (action: FighterAction, skill?: SkillId) => {
                    const row = this.getAnimationForAction(fighter.gender, weaponId, action, skill);
                    this.getFrames(row.id);
                    result.set(row.id, row);
                };
                // 任意动作都可能在达到最大战斗帧时进入结算。
                add(FighterAction.Victory);
                add(FighterAction.Dead);
                if (armed) {
                    add(FighterAction.Equip);
                    add(FighterAction.Throw);
                }
                // 远程武器取出后直接投出，不会持械移动、普攻或施放技能。
                if (weapon.ranged) continue;
                for (const action of [FighterAction.Idle, FighterAction.Run, FighterAction.Retreat,
                    FighterAction.Hurt, FighterAction.Dodge, FighterAction.Attack]) add(action);
                if (armed && skills.some(skill => skill.requiresUnarmed)) {
                    add(FighterAction.PutDown);
                    add(FighterAction.PickUp);
                }
                for (const skill of skills) {
                    if (!armed || !skill.requiresUnarmed) add(FighterAction.Skill, skill.id);
                }
            }
        }
        return Array.from(result.values());
    }

    format(template: string, value: string | number) {
        return template.replace("{0}", String(value));
    }

    private validateBattleDefinitions() {
        const rules = this.battle.rules;
        if (rules.frameRate <= 0 || rules.countdownFrames < 0 || rules.maxFrames <= rules.countdownFrames ||
            rules.moveSpeed <= 0 || rules.projectileSpeed <= 0 || rules.maxCatchUpFrames <= 0) {
            throw new Error("战斗规则配置无效");
        }
        if (!this.battle.weapons.has(rules.defaultWeapon)) throw new Error("默认武器不存在");
        for (const weapon of this.battle.weapons.values()) {
            if (weapon.damage <= 0 || weapon.range <= 0 || weapon.windup < 0 || weapon.recovery < 0) {
                throw new Error("武器配置无效：" + weapon.id);
            }
        }
        for (const skill of this.battle.skills.values()) {
            if (skill.power <= 0 || skill.hitFrame < 0 || skill.duration <= skill.hitFrame) {
                throw new Error("技能配置无效：" + skill.id);
            }
        }
    }
}
