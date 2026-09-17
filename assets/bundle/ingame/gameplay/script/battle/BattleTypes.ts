/** 逻辑层不依赖 Cocos；时间统一使用 20Hz 服务帧，坐标统一使用整数。 */
export const FRAME_RATE = 20;
export const FRAME_SECONDS = 1 / FRAME_RATE;
export const COUNTDOWN_FRAMES = 60;
export const MAX_BATTLE_FRAMES = 7200;
export const MAX_HP = 360;

export enum FighterGender { Male, Female }
export enum WeaponId { Fist, Dagger, Spear, FlyingKnife }
export enum FighterAction { Idle, Run, Attack, Retreat, Throw, Dead, Victory, Equip, Hurt, Dodge, Skill, PutDown, PickUp }
export enum BattlePhase { Countdown, Fighting, Finished }
export enum CommandType { Equip }
export enum BattleEventType { Attack, Throw, Hit, Dodge, Block, Equip, Finish, Skill, Heal, PutDown, PickUp }
export enum SkillId { None = 0, MineralWater = 22, ShadowlessKick = 25, PenguinRoar = 27 }

/** 原版技能名称与导出动画时间轴；威力由模拟对战数据提供。 */
export const SKILLS = {
    [SkillId.None]: { name: "", clip: "", hitFrame: 0, duration: 0, downWeapon: false },
    [SkillId.MineralWater]: { name: "矿泉水", clip: "skill-water", hitFrame: 30, duration: 61, downWeapon: false },
    [SkillId.ShadowlessKick]: { name: "佛山无影脚", clip: "skill-kick", hitFrame: 30, duration: 60, downWeapon: true },
    [SkillId.PenguinRoar]: { name: "企鹅吼", clip: "skill-roar", hitFrame: 27, duration: 48, downWeapon: false },
} as const;

/** 单机响应中的技能效果数值，不冒充原版服务器公式。 */
export interface SkillInfo { id: SkillId; power: number; }

/** 模拟服务器返回的参战者信息。 */
export interface FighterInfo {
    id: number;
    name: string;
    gender: FighterGender;
    hp: number;
    maxHp: number;
    weapons: WeaponId[];
    skills: SkillInfo[];
}

/** 对战初始化数据；场景不预设双方的武器库存。 */
export interface BattleInfo {
    id: string;
    seed: number;
    fighters: FighterInfo[];
}

export const WEAPONS = [
    { name: "空手", damage: 16, range: 105, windup: 5, recovery: 13, icon: "", role: "fist", isRanged: false },
    { name: "短剑", damage: 25, range: 135, windup: 5, recovery: 12, icon: "weapon-sword", role: "sword", isRanged: false },
    { name: "红缨枪", damage: 34, range: 185, windup: 8, recovery: 17, icon: "weapon-spear", role: "spear", isRanged: false },
    // 官网武器 23：spcType=2，原地出手、直线飞行；伤害仍是 Demo 参数。
    { name: "小李飞刀", damage: 28, range: 700, windup: 9, recovery: 22, icon: "weapon-knife", role: "knife", isRanged: true },
] as const;

export interface BattleCommand {
    player: number;
    sequence: number;
    type: CommandType;
    weapon: WeaponId;
}

export interface ServiceFrame {
    tick: number;
    commands: readonly BattleCommand[];
}

export interface FighterState {
    id: number;
    hp: number;
    maxHp: number;
    x: number;
    previousX: number;
    facing: number;
    weapon: WeaponId;
    stowedWeapon: WeaponId;
    inventory: WeaponId[];
    skill: SkillId;
    usedSkills: SkillId[];
    action: FighterAction;
    actionFrame: number;
    resolveFrame: number;
    readyFrame: number;
    equipFrame: number;
    attacks: number;
    combo: number;
    damageDealt: number;
    dodges: number;
    lastEquipFrame: number;
}

export interface ProjectileState {
    id: number;
    owner: number;
    target: number;
    weapon: WeaponId;
    startX: number;
    endX: number;
    startFrame: number;
    endFrame: number;
}

export interface BattleEvent {
    type: BattleEventType;
    actor: number;
    target?: number;
    damage?: number;
    critical?: boolean;
    combo?: boolean;
    weapon?: WeaponId;
    skill?: SkillId;
}

export interface BattleRecording {
    version: 2;
    battle: BattleInfo;
    frames: ServiceFrame[];
}

/** 有种子的整数随机数；禁止在战斗逻辑里使用 Math.random。 */
export class BattleRandom {
    state: number;

    constructor(seed: number) { this.state = (seed >>> 0) || 1; }

    next(max: number): number {
        let value = this.state;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.state = value >>> 0;
        return this.state % max;
    }
}
