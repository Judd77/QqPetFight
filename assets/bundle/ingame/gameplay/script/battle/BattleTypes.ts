/** 战斗逻辑层只使用整数帧和整数坐标，不依赖 Cocos 或 Luban 生成类型。 */
export enum FighterGender { Male, Female }
export type WeaponId = number;
export type SkillId = number;
export type AnimationId = number;
export enum SkillEffect { Damage, Heal }
export enum BattlePhase { Countdown, Fighting, Finished }
export enum FighterAction { Idle, Run, Attack, Retreat, Throw, Dead, Victory, Equip, Hurt, Dodge, Skill, PutDown, PickUp }
export enum BattleIntent { Attack, Equip, Throw, Skill }
export enum BattleCommandType { Act }
export enum BattleEventType { Countdown, Start, Move, Attack, Throw, Hit, Dodge, Block, Equip, Finish, Skill, Heal, PutDown, PickUp }

export interface BattleRules {
    version: number;
    demoSeed: number;
    frameRate: number;
    countdownFrames: number;
    maxFrames: number;
    defaultWeapon: WeaponId;
    leftStartX: number;
    rightStartX: number;
    moveSpeed: number;
    nextTurnDelay: number;
    dodgeChance: number;
    criticalChance: number;
    criticalMultiplier: number;
    damageVariance: number;
    hurtFrames: number;
    dodgeFrames: number;
    throwChance: number;
    skillChance: number;
    healThreshold: number;
    projectileSpeed: number;
    projectileMinFrames: number;
    maxCatchUpFrames: number;
}

export interface WeaponDefinition {
    id: WeaponId;
    name: string;
    damage: number;
    range: number;
    windup: number;
    recovery: number;
    attackAnimation: AnimationId;
    ranged: boolean;
    equipFrames: number;
    putDownFrames: number;
    pickUpFrames: number;
    projectileArc: number;
    projectileOffset: number;
    projectileRotation: number;
    iconPath: string;
    attackSoundMale: string;
    attackSoundFemale: string;
    throwSound: string;
    hurtSoundMale: string;
    hurtSoundFemale: string;
}

export interface SkillDefinition {
    id: SkillId;
    name: string;
    effect: SkillEffect;
    power: number;
    animation: AnimationId;
    hitFrame: number;
    duration: number;
    requiresUnarmed: boolean;
    iconPath: string;
    sound: string;
    /** 是否可重复施放；NPC 的固有攻击也通过技能指令执行。 */
    repeatable: boolean;
}

export interface BattleDefinitions {
    rules: BattleRules;
    weapons: ReadonlyMap<WeaponId, WeaponDefinition>;
    skills: ReadonlyMap<SkillId, SkillDefinition>;
}

export interface SkillInfo {
    id: SkillId;
    power: number;
}

export interface FighterInfo {
    id: number;
    name: string;
    gender: FighterGender;
    hp: number;
    maxHp: number;
    weapons: WeaponId[];
    skills: SkillInfo[];
    /** 服务端下发的头像资源；未提供时使用性别默认头像。 */
    portraitPath?: string;
    /** NPC 外观配置编号；玩家不提供此字段。 */
    npcId?: number;
}

export interface BattleInfo {
    id: string;
    seed: number;
    fighters: FighterInfo[];
}

export interface BattleCommand {
    player: number;
    sequence: number;
    type: BattleCommandType;
    intent: BattleIntent;
    entryId: number;
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
    skill?: SkillId;
    usedSkills: SkillId[];
    action: FighterAction;
    actionWeapon: WeaponId;
    actionFrame: number;
    readyFrame: number;
    attacks: number;
    combo: number;
    damageDealt: number;
    dodges: number;
}

export interface ProjectileState {
    id: number;
    owner: number;
    target: number;
    weapon: WeaponId;
    damage: number;
    startX: number;
    endX: number;
    startFrame: number;
    endFrame: number;
}

export interface BattleState {
    tick: number;
    phase: BattlePhase;
    winner: number;
    round: number;
    activePlayer: number;
    nextActionFrame: number;
    fighters: FighterState[];
    projectiles: ProjectileState[];
}

export interface BattleEvent {
    type: BattleEventType;
    actor: number;
    target?: number;
    damage?: number;
    critical?: boolean;
    weapon?: WeaponId;
    skill?: SkillId;
}

export interface BattleStepResult {
    state: Readonly<BattleState>;
    events: readonly BattleEvent[];
}

export interface BattleRecording {
    version: 4;
    configVersion: number;
    battle: BattleInfo;
    frames: ServiceFrame[];
}

/** 有种子的整数随机数；确定性逻辑中禁止使用 Math.random。 */
export class BattleRandom {
    state: number;

    constructor(seed: number) {
        this.state = (seed >>> 0) || 1;
    }

    next(max: number): number {
        if (!Number.isSafeInteger(max) || max <= 0) throw new Error("随机范围无效");
        let value = this.state;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.state = value >>> 0;
        return this.state % max;
    }
}
