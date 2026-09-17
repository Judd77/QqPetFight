import {
    BattleEvent, BattleEventType, BattleInfo, BattlePhase, BattleRandom, COUNTDOWN_FRAMES,
    FighterAction, FighterState, MAX_BATTLE_FRAMES, ProjectileState, ServiceFrame, SkillId, SKILLS, WeaponId, WEAPONS,
} from "./BattleTypes";

enum TurnPhase { Choose, Approach, Act, Return, PutDown, PickUp }

/** 按原版战报演出顺序推进单机战斗；伤害与出招概率仍是待校准的 Demo 参数。 */
export class BattleWorld {
    readonly random: BattleRandom;
    readonly fighters: FighterState[];
    readonly projectiles: ProjectileState[] = [];
    readonly events: BattleEvent[] = [];
    tick = 0;
    phase = BattlePhase.Countdown;
    winner = -1;
    round = 0;
    activePlayer = 0;
    private turnPhase = TurnPhase.Choose;
    private projectileId = 0;
    private nextTurnFrame = COUNTDOWN_FRAMES;

    constructor(readonly info: BattleInfo) {
        this.random = new BattleRandom(info.seed);
        this.fighters = info.fighters.map((data) => {
            const id = data.id;
            return {
            id, hp: data.hp, maxHp: data.maxHp, x: id === 0 ? -300 : 300, previousX: id === 0 ? -300 : 300,
            facing: id === 0 ? 1 : -1, weapon: WeaponId.Fist, stowedWeapon: WeaponId.Fist, inventory: [...data.weapons], skill: SkillId.None, usedSkills: [] as SkillId[],
            action: FighterAction.Idle, actionFrame: 0, resolveFrame: 0, readyFrame: COUNTDOWN_FRAMES,
            equipFrame: 0, attacks: 0, combo: 0, damageDealt: 0, dodges: 0, lastEquipFrame: -40,
            };
        });
    }

    /** 初始种子由对战数据提供。 */
    get seed() { return this.info.seed; }

    /** 连续推进服务帧；观战期间不接受即时换装输入。 */
    step(frame: ServiceFrame) {
        if (frame.tick !== this.tick + 1) throw new Error("服务帧不连续：" + frame.tick);
        this.tick = frame.tick;
        this.events.length = 0;
        for (const fighter of this.fighters) fighter.previousX = fighter.x;
        if (this.phase === BattlePhase.Finished || this.tick < COUNTDOWN_FRAMES) return;
        this.phase = BattlePhase.Fighting;
        for (const fighter of this.fighters) {
            if ((fighter.action === FighterAction.Hurt || fighter.action === FighterAction.Dodge) &&
                this.tick >= fighter.readyFrame) this.setAction(fighter, FighterAction.Idle);
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i]!;
            if (this.tick < projectile.endFrame) continue;
            this.hit(projectile.owner, projectile.target, WEAPONS[projectile.weapon].damage);
            this.projectiles.splice(i, 1);
        }
        if (this.checkFinish()) return;
        this.updateTurn();
        this.checkFinish();
    }

    /** 一次只播放一方的出招，完成归位后才开始下一次行动。 */
    private updateTurn() {
        const fighter = this.fighters[this.activePlayer]!;
        const target = this.fighters[1 - this.activePlayer]!;
        switch (this.turnPhase) {
            case TurnPhase.Choose:
                if (this.tick < this.nextTurnFrame) return;
                this.round++;
                if (this.tryUseSkill(fighter)) {
                    this.turnPhase = fighter.action === FighterAction.PutDown ? TurnPhase.PutDown : TurnPhase.Act;
                    return;
                }
                if (fighter.weapon === WeaponId.Fist && fighter.inventory.length > 0) {
                    const index = this.random.next(fighter.inventory.length);
                    fighter.weapon = fighter.inventory.splice(index, 1)[0]!;
                    this.setAction(fighter, FighterAction.Equip);
                    fighter.readyFrame = this.tick + (fighter.weapon === WeaponId.Spear ? 10 : 14);
                    this.events.push({ type: BattleEventType.Equip, actor: fighter.id, weapon: fighter.weapon });
                    this.turnPhase = TurnPhase.Approach;
                } else if (fighter.weapon !== WeaponId.Fist && (WEAPONS[fighter.weapon].isRanged || this.random.next(100) < 28)) {
                    this.beginAction(fighter, FighterAction.Throw, 9, 22);
                    this.turnPhase = TurnPhase.Act;
                } else {
                    this.turnPhase = TurnPhase.Approach;
                }
                return;
            case TurnPhase.Approach: {
                if (this.tick < fighter.readyFrame) return;
                if (WEAPONS[fighter.weapon].isRanged) {
                    this.beginAction(fighter, FighterAction.Throw, 9, 22);
                    this.turnPhase = TurnPhase.Act;
                    return;
                }
                const distance = Math.abs(fighter.x - target.x);
                const range = fighter.weapon === WeaponId.Fist ? 108 : 155;
                if (distance > range) {
                    this.setAction(fighter, FighterAction.Run);
                    fighter.x += fighter.facing * Math.min(18, distance - range);
                    return;
                }
                this.beginAction(fighter, FighterAction.Attack, fighter.weapon === WeaponId.Fist ? 6 : 12,
                    fighter.weapon === WeaponId.Fist ? 7 : 14);
                this.events.push({ type: BattleEventType.Attack, actor: fighter.id, weapon: fighter.weapon });
                this.turnPhase = TurnPhase.Act;
                return;
            }
            case TurnPhase.PutDown:
                if (this.tick < fighter.readyFrame) return;
                fighter.stowedWeapon = fighter.weapon;
                fighter.weapon = WeaponId.Fist;
                this.beginSkill(fighter);
                this.turnPhase = TurnPhase.Act;
                return;
            case TurnPhase.PickUp:
                if (this.tick < fighter.readyFrame) return;
                this.turnPhase = TurnPhase.Return;
                return;
            case TurnPhase.Act:
                if (fighter.resolveFrame === this.tick) {
                    if (fighter.action === FighterAction.Skill) this.resolveSkill(fighter, target);
                    else if (fighter.action === FighterAction.Throw) this.throwWeapon(fighter, target);
                    else this.hit(fighter.id, target.id, WEAPONS[fighter.weapon].damage);
                    fighter.resolveFrame = 0;
                    fighter.attacks++;
                }
                if (this.tick < fighter.readyFrame || this.projectiles.length > 0 || this.tick < target.readyFrame) return;
                if (fighter.stowedWeapon !== WeaponId.Fist) {
                    fighter.weapon = fighter.stowedWeapon;
                    fighter.stowedWeapon = WeaponId.Fist;
                    this.setAction(fighter, FighterAction.PickUp);
                    fighter.readyFrame = this.tick + (fighter.weapon === WeaponId.Spear ? 8 : 6);
                    this.events.push({ type: BattleEventType.PickUp, actor: fighter.id, weapon: fighter.weapon });
                    this.turnPhase = TurnPhase.PickUp;
                } else {
                    this.turnPhase = TurnPhase.Return;
                }
                return;
            case TurnPhase.Return: {
                const home = fighter.id === 0 ? -300 : 300;
                const distance = home - fighter.x;
                if (Math.abs(distance) > 0) {
                    this.setAction(fighter, FighterAction.Retreat);
                    fighter.x += Math.sign(distance) * Math.min(18, Math.abs(distance));
                    return;
                }
                this.setAction(fighter, FighterAction.Idle);
                this.activePlayer = 1 - this.activePlayer;
                this.nextTurnFrame = this.tick + 8;
                this.turnPhase = TurnPhase.Choose;
            }
        }
    }

    /** 模拟服务的技能选择；触发概率不是已核实的原版规则。 */
    private tryUseSkill(fighter: FighterState): boolean {
        if (fighter.attacks === 0) return false;
        const available = this.info.fighters[fighter.id]!.skills.filter((skill) => !fighter.usedSkills.includes(skill.id));
        const water = available.find((skill) => skill.id === SkillId.MineralWater);
        const attacks = available.filter((skill) => skill.id !== SkillId.MineralWater);
        const chosen = water && fighter.hp * 5 <= fighter.maxHp * 3
            ? water : attacks.length > 0 && this.random.next(100) < 25 ? attacks[this.random.next(attacks.length)] : undefined;
        if (!chosen) return false;
        fighter.skill = chosen.id;
        fighter.usedSkills.push(chosen.id);
        if (SKILLS[chosen.id].downWeapon && fighter.weapon !== WeaponId.Fist) {
            this.setAction(fighter, FighterAction.PutDown);
            fighter.readyFrame = this.tick + (fighter.weapon === WeaponId.Spear ? 13 : 11);
            this.events.push({ type: BattleEventType.PutDown, actor: fighter.id, weapon: fighter.weapon });
        } else {
            this.beginSkill(fighter);
        }
        return true;
    }

    /** 暂放动作完成后再开始技能，效果帧不会提前消耗。 */
    private beginSkill(fighter: FighterState) {
        const clip = SKILLS[fighter.skill];
        this.beginAction(fighter, FighterAction.Skill, clip.hitFrame, clip.duration - clip.hitFrame);
        this.events.push({ type: BattleEventType.Skill, actor: fighter.id, skill: fighter.skill });
    }

    /** 在技能时间轴的效果帧应用模拟响应中的伤害或治疗值。 */
    private resolveSkill(fighter: FighterState, target: FighterState) {
        const skill = this.info.fighters[fighter.id]!.skills.find((item) => item.id === fighter.skill)!;
        if (skill.id === SkillId.MineralWater) {
            const restored = Math.min(skill.power, fighter.maxHp - fighter.hp);
            fighter.hp += restored;
            this.events.push({ type: BattleEventType.Heal, actor: fighter.id, target: fighter.id, damage: restored, skill: skill.id });
        } else {
            this.hit(fighter.id, target.id, skill.power);
        }
    }

    /** 仅在动作改变时重置时间轴。 */
    private setAction(fighter: FighterState, action: FighterAction) {
        if (fighter.action === action) return;
        fighter.action = action;
        fighter.actionFrame = this.tick;
    }

    /** 前摇、命中和收招由逻辑时间轴决定。 */
    private beginAction(fighter: FighterState, action: FighterAction, windup: number, recovery: number) {
        this.setAction(fighter, action);
        fighter.actionFrame = this.tick;
        fighter.resolveFrame = this.tick + windup;
        fighter.readyFrame = this.tick + windup + recovery;
    }

    /** 武器脱手后独立飞行，不自动补回库存。 */
    private throwWeapon(fighter: FighterState, target: FighterState) {
        if (fighter.weapon === WeaponId.Fist) return;
        this.projectiles.push({
            id: ++this.projectileId, owner: fighter.id, target: target.id, weapon: fighter.weapon,
            startX: fighter.x + fighter.facing * 65, endX: target.x,
            startFrame: this.tick, endFrame: this.tick + Math.max(8, Math.ceil(Math.abs(target.x - fighter.x) / 35)),
        });
        this.events.push({ type: BattleEventType.Throw, actor: fighter.id, weapon: fighter.weapon });
        fighter.weapon = WeaponId.Fist;
    }

    /** 暂用 Demo 数值验证出招链路；不宣称已还原官网服务端公式。 */
    private hit(attackerId: number, targetId: number, baseDamage: number) {
        const attacker = this.fighters[attackerId]!;
        const target = this.fighters[targetId]!;
        if (this.random.next(100) < 12) {
            target.dodges++;
            this.setAction(target, FighterAction.Dodge);
            target.readyFrame = this.tick + 20;
            this.events.push({ type: BattleEventType.Dodge, actor: attackerId, target: targetId });
            return;
        }
        const critical = this.random.next(100) < 15;
        const damage = Math.max(1, Math.floor((baseDamage + this.random.next(7) - 3) * (critical ? 1.5 : 1)));
        const applied = Math.min(target.hp, damage);
        target.hp -= applied;
        attacker.damageDealt += applied;
        this.setAction(target, FighterAction.Hurt);
        target.readyFrame = this.tick + 18;
        this.events.push({ type: BattleEventType.Hit, actor: attackerId, target: targetId, damage: applied, critical });
    }

    /** 生命耗尽或超过演示时限时结算。 */
    private checkFinish(): boolean {
        if (this.fighters.every((fighter) => fighter.hp > 0) && this.tick < MAX_BATTLE_FRAMES) return false;
        this.phase = BattlePhase.Finished;
        const [left, right] = this.fighters;
        this.winner = left!.hp === right!.hp ? -1 : left!.hp > right!.hp ? 0 : 1;
        for (const fighter of this.fighters) {
            this.setAction(fighter, fighter.id === this.winner ? FighterAction.Victory : FighterAction.Dead);
        }
        this.projectiles.length = 0;
        this.events.push({ type: BattleEventType.Finish, actor: this.winner });
        return true;
    }

    /** 覆盖全部未来相关状态，验证重播结果。 */
    checksum(): string {
        const source = JSON.stringify({
            tick: this.tick, phase: this.phase, winner: this.winner, random: this.random.state,
            round: this.round, activePlayer: this.activePlayer, turnPhase: this.turnPhase,
            nextTurnFrame: this.nextTurnFrame, projectileId: this.projectileId,
            fighters: this.fighters, projectiles: this.projectiles,
        });
        let hash = 2166136261;
        for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
        return (hash >>> 0).toString(16).padStart(8, "0");
    }
}
