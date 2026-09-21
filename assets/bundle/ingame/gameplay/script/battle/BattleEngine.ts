import { BattleActionQueue, BattleActionStep, BattleActionStepType } from "./BattleActionQueue";
import {
    BattleCommand, BattleCommandType, BattleDefinitions, BattleEvent, BattleEventType, BattleInfo, BattleIntent, BattlePhase,
    BattleRandom, BattleState, BattleStepResult, FighterAction, FighterState, ProjectileState, ServiceFrame,
    SkillEffect, SkillId, WeaponId,
} from "./BattleTypes";

/** 纯 TypeScript 确定性战斗内核：只消费服务帧并输出状态与事件。 */
export class BattleEngine {
    readonly info: BattleInfo;
    readonly state: BattleState;
    readonly random: BattleRandom;
    readonly actions = new BattleActionQueue();
    private readonly events: BattleEvent[] = [];
    private projectileId = 0;

    constructor(info: BattleInfo, readonly config: BattleDefinitions) {
        this.info = JSON.parse(JSON.stringify(info)) as BattleInfo;
        this.random = new BattleRandom(this.info.seed);
        const rules = config.rules;
        this.state = {
            tick: 0,
            phase: BattlePhase.Countdown,
            winner: -1,
            round: 0,
            activePlayer: 0,
            nextActionFrame: rules.countdownFrames,
            fighters: this.info.fighters.map((fighter) => {
                const x = fighter.id === 0 ? rules.leftStartX : rules.rightStartX;
                return {
                    id: fighter.id,
                    hp: fighter.hp,
                    maxHp: fighter.maxHp,
                    x,
                    previousX: x,
                    facing: fighter.id === 0 ? 1 : -1,
                    weapon: rules.defaultWeapon,
                    stowedWeapon: rules.defaultWeapon,
                    inventory: fighter.weapons.slice(),
                    skill: undefined,
                    usedSkills: [],
                    action: FighterAction.Idle,
                    actionWeapon: rules.defaultWeapon,
                    actionFrame: 0,
                    readyFrame: rules.countdownFrames,
                    attacks: 0,
                    combo: 0,
                    damageDealt: 0,
                    dodges: 0,
                };
            }),
            projectiles: [],
        };
    }

    get needsCommand() {
        return this.state.phase !== BattlePhase.Finished &&
            this.state.tick >= this.config.rules.countdownFrames &&
            this.actions.empty &&
            this.state.tick >= this.state.nextActionFrame;
    }

    step(frame: ServiceFrame): BattleStepResult {
        if (frame.tick !== this.state.tick + 1) throw new Error("服务帧不连续：" + frame.tick);
        this.state.tick = frame.tick;
        this.events.length = 0;
        for (const fighter of this.state.fighters) fighter.previousX = fighter.x;
        if (this.state.phase === BattlePhase.Finished) return this.result();

        const rules = this.config.rules;
        if (this.state.tick < rules.countdownFrames) {
            if (this.state.tick % rules.frameRate === 0) {
                this.events.push({ type: BattleEventType.Countdown, actor: -1 });
            }
            return this.result();
        }
        if (this.state.phase === BattlePhase.Countdown) {
            this.state.phase = BattlePhase.Fighting;
            this.events.push({ type: BattleEventType.Start, actor: -1 });
        }

        this.updateReactionStates();
        this.updateProjectiles();
        if (this.checkFinish()) return this.result();

        if (this.actions.empty && this.state.tick >= this.state.nextActionFrame) {
            const command = frame.commands.find((item) => item.player === this.state.activePlayer);
            if (command) this.beginCommand(command);
        }
        this.updateAction();
        this.checkFinish();
        return this.result();
    }

    checksum(): string {
        const source = JSON.stringify({
            state: this.state,
            random: this.random.state,
            projectileId: this.projectileId,
            actions: this.actions.snapshot(),
        });
        let hash = 2166136261;
        for (let index = 0; index < source.length; index++) {
            hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    private result(): BattleStepResult {
        return { state: this.state, events: this.events };
    }

    private beginCommand(command: BattleCommand) {
        if (command.type !== BattleCommandType.Act || command.player !== this.state.activePlayer) return;
        const actor = this.actor;
        const target = this.target;
        const steps: BattleActionStep[] = [];
        switch (command.intent) {
            case BattleIntent.Equip: {
                const weapon = command.entryId as WeaponId;
                if (actor.weapon !== this.config.rules.defaultWeapon || !actor.inventory.includes(weapon)) return;
                steps.push({ type: BattleActionStepType.Equip, weapon });
                if (this.weapon(weapon).ranged) {
                    steps.push({ type: BattleActionStepType.Throw, weapon });
                } else {
                    steps.push({ type: BattleActionStepType.Approach, weapon });
                    steps.push({ type: BattleActionStepType.Attack, weapon });
                }
                break;
            }
            case BattleIntent.Attack:
                if (this.weapon(actor.weapon).ranged) return;
                steps.push({ type: BattleActionStepType.Approach, weapon: actor.weapon });
                steps.push({ type: BattleActionStepType.Attack, weapon: actor.weapon });
                break;
            case BattleIntent.Throw:
                if (actor.weapon === this.config.rules.defaultWeapon) return;
                steps.push({ type: BattleActionStepType.Throw, weapon: actor.weapon });
                break;
            case BattleIntent.Skill: {
                const skillId = command.entryId as SkillId;
                const skill = this.config.skills.get(skillId);
                if (!skill || (!skill.repeatable && actor.usedSkills.includes(skillId)) ||
                    !this.info.fighters[actor.id]!.skills.some((item) => item.id === skillId)) return;
                actor.skill = skillId;
                if (!skill.repeatable) actor.usedSkills.push(skillId);
                if (skill.requiresUnarmed && actor.weapon !== this.config.rules.defaultWeapon) {
                    steps.push({ type: BattleActionStepType.PutDown, weapon: actor.weapon });
                }
                steps.push({ type: BattleActionStepType.Skill, skill: skillId });
                if (skill.requiresUnarmed && actor.weapon !== this.config.rules.defaultWeapon) {
                    steps.push({ type: BattleActionStepType.PickUp, weapon: actor.weapon });
                }
                break;
            }
            default:
                return;
        }
        steps.push({ type: BattleActionStepType.Wait });
        steps.push({ type: BattleActionStepType.Return });
        steps.push({ type: BattleActionStepType.Complete });
        this.state.round++;
        this.actions.replace(steps);
        if (Math.abs(actor.x - target.x) <= 0) throw new Error("参战者位置重叠");
    }

    private updateAction() {
        const step = this.actions.current;
        if (!step) return;
        switch (step.type) {
            case BattleActionStepType.Equip:
                this.updateEquip(step);
                break;
            case BattleActionStepType.Approach:
                this.updateApproach(step);
                break;
            case BattleActionStepType.Attack:
                this.updateAttack(step);
                break;
            case BattleActionStepType.Throw:
                this.updateThrow(step);
                break;
            case BattleActionStepType.PutDown:
                this.updatePutDown(step);
                break;
            case BattleActionStepType.Skill:
                this.updateSkill(step);
                break;
            case BattleActionStepType.Wait:
                if (this.state.tick >= this.actor.readyFrame && this.state.tick >= this.target.readyFrame &&
                    this.state.projectiles.length === 0) this.actions.advance();
                break;
            case BattleActionStepType.PickUp:
                this.updatePickUp(step);
                break;
            case BattleActionStepType.Return:
                this.updateReturn();
                break;
            case BattleActionStepType.Complete:
                this.completeTurn();
                break;
        }
    }

    private updateEquip(step: BattleActionStep) {
        const actor = this.actor;
        const weaponId = step.weapon!;
        const weapon = this.weapon(weaponId);
        if (step.startedFrame === undefined) {
            const index = actor.inventory.indexOf(weaponId);
            if (index < 0) throw new Error("装备不在库存中：" + weaponId);
            actor.inventory.splice(index, 1);
            actor.weapon = weaponId;
            this.startTimedStep(step, FighterAction.Equip, weapon.equipFrames);
            this.events.push({ type: BattleEventType.Equip, actor: actor.id, weapon: weaponId });
        }
        if (this.state.tick >= step.endFrame!) this.actions.advance();
    }

    private updateApproach(step: BattleActionStep) {
        const actor = this.actor;
        const target = this.target;
        const range = this.weapon(step.weapon!).range;
        const distance = Math.abs(actor.x - target.x);
        if (distance <= range) {
            this.actions.advance();
            return;
        }
        const changed = this.setAction(actor, FighterAction.Run);
        actor.x += actor.facing * Math.min(this.config.rules.moveSpeed, distance - range);
        if (changed) this.events.push({ type: BattleEventType.Move, actor: actor.id });
    }

    private updateAttack(step: BattleActionStep) {
        const actor = this.actor;
        const weapon = this.weapon(step.weapon!);
        if (step.startedFrame === undefined) {
            this.startResolvedStep(step, FighterAction.Attack, weapon.windup, weapon.recovery);
            this.events.push({ type: BattleEventType.Attack, actor: actor.id, weapon: weapon.id });
        }
        if (!step.resolved && this.state.tick >= step.resolveFrame!) {
            step.resolved = true;
            actor.attacks++;
            this.hit(actor.id, this.target.id, weapon.damage);
        }
        if (this.state.tick >= step.endFrame!) this.actions.advance();
    }

    private updateThrow(step: BattleActionStep) {
        const actor = this.actor;
        const target = this.target;
        const weapon = this.weapon(step.weapon!);
        if (step.startedFrame === undefined) {
            this.startResolvedStep(step, FighterAction.Throw, weapon.windup, weapon.recovery);
            this.events.push({ type: BattleEventType.Throw, actor: actor.id, weapon: weapon.id });
        }
        if (!step.resolved && this.state.tick >= step.resolveFrame!) {
            step.resolved = true;
            actor.attacks++;
            const travel = Math.max(
                this.config.rules.projectileMinFrames,
                Math.ceil(Math.abs(target.x - actor.x) / this.config.rules.projectileSpeed),
            );
            this.state.projectiles.push({
                id: ++this.projectileId,
                owner: actor.id,
                target: target.id,
                weapon: weapon.id,
                damage: weapon.damage,
                startX: actor.x + actor.facing * weapon.projectileOffset,
                endX: target.x,
                startFrame: this.state.tick,
                endFrame: this.state.tick + travel,
            });
            actor.weapon = this.config.rules.defaultWeapon;
        }
        if (this.state.tick >= step.endFrame!) this.actions.advance();
    }

    private updatePutDown(step: BattleActionStep) {
        const actor = this.actor;
        const weapon = this.weapon(step.weapon!);
        if (step.startedFrame === undefined) {
            actor.stowedWeapon = actor.weapon;
            actor.weapon = this.config.rules.defaultWeapon;
            this.startTimedStep(step, FighterAction.PutDown, weapon.putDownFrames, weapon.id);
            this.events.push({ type: BattleEventType.PutDown, actor: actor.id, weapon: weapon.id });
        }
        if (this.state.tick >= step.endFrame!) this.actions.advance();
    }

    private updateSkill(step: BattleActionStep) {
        const actor = this.actor;
        const skill = this.skill(step.skill!);
        if (step.startedFrame === undefined) {
            this.startResolvedStep(step, FighterAction.Skill, skill.hitFrame, skill.duration - skill.hitFrame);
            this.events.push({ type: BattleEventType.Skill, actor: actor.id, skill: skill.id });
        }
        if (!step.resolved && this.state.tick >= step.resolveFrame!) {
            step.resolved = true;
            actor.attacks++;
            const info = this.info.fighters[actor.id]!.skills.find((item) => item.id === skill.id);
            if (!info) throw new Error("参战数据缺少技能：" + skill.id);
            if (skill.effect === SkillEffect.Heal) {
                const restored = Math.min(info.power, actor.maxHp - actor.hp);
                actor.hp += restored;
                this.events.push({ type: BattleEventType.Heal, actor: actor.id, target: actor.id, damage: restored, skill: skill.id });
            } else {
                this.hit(actor.id, this.target.id, info.power);
            }
        }
        if (this.state.tick >= step.endFrame!) this.actions.advance();
    }

    private updatePickUp(step: BattleActionStep) {
        const actor = this.actor;
        const weapon = this.weapon(step.weapon!);
        if (step.startedFrame === undefined) {
            actor.weapon = actor.stowedWeapon;
            actor.stowedWeapon = this.config.rules.defaultWeapon;
            this.startTimedStep(step, FighterAction.PickUp, weapon.pickUpFrames);
            this.events.push({ type: BattleEventType.PickUp, actor: actor.id, weapon: weapon.id });
        }
        if (this.state.tick >= step.endFrame!) this.actions.advance();
    }

    private updateReturn() {
        const actor = this.actor;
        const home = actor.id === 0 ? this.config.rules.leftStartX : this.config.rules.rightStartX;
        const distance = home - actor.x;
        if (distance === 0) {
            this.setAction(actor, FighterAction.Idle);
            this.actions.advance();
            return;
        }
        const changed = this.setAction(actor, FighterAction.Retreat);
        actor.x += Math.sign(distance) * Math.min(this.config.rules.moveSpeed, Math.abs(distance));
        if (changed) this.events.push({ type: BattleEventType.Move, actor: actor.id });
    }

    private completeTurn() {
        this.setAction(this.actor, FighterAction.Idle);
        this.actor.skill = undefined;
        this.state.activePlayer = 1 - this.state.activePlayer;
        this.state.nextActionFrame = this.state.tick + this.config.rules.nextTurnDelay;
        this.actions.clear();
    }

    private updateReactionStates() {
        for (const fighter of this.state.fighters) {
            if ((fighter.action === FighterAction.Hurt || fighter.action === FighterAction.Dodge) &&
                this.state.tick >= fighter.readyFrame) this.setAction(fighter, FighterAction.Idle);
        }
    }

    private updateProjectiles() {
        for (let index = this.state.projectiles.length - 1; index >= 0; index--) {
            const projectile = this.state.projectiles[index]!;
            if (this.state.tick < projectile.endFrame) continue;
            this.hit(projectile.owner, projectile.target, projectile.damage);
            this.state.projectiles.splice(index, 1);
        }
    }

    private hit(attackerId: number, targetId: number, baseDamage: number) {
        const attacker = this.state.fighters[attackerId]!;
        const target = this.state.fighters[targetId]!;
        const rules = this.config.rules;
        if (this.random.next(100) < rules.dodgeChance) {
            target.dodges++;
            this.setAction(target, FighterAction.Dodge);
            target.readyFrame = this.state.tick + rules.dodgeFrames;
            this.events.push({ type: BattleEventType.Dodge, actor: attackerId, target: targetId });
            return;
        }
        const critical = this.random.next(100) < rules.criticalChance;
        const variance = rules.damageVariance;
        const damage = Math.max(1, Math.floor(
            (baseDamage + this.random.next(variance * 2 + 1) - variance) * (critical ? rules.criticalMultiplier : 1),
        ));
        const applied = Math.min(target.hp, damage);
        target.hp -= applied;
        attacker.damageDealt += applied;
        this.setAction(target, FighterAction.Hurt);
        target.readyFrame = this.state.tick + rules.hurtFrames;
        this.events.push({ type: BattleEventType.Hit, actor: attackerId, target: targetId, damage: applied, critical });
    }

    private checkFinish() {
        if (this.state.fighters.every((fighter) => fighter.hp > 0) && this.state.tick < this.config.rules.maxFrames) return false;
        this.state.phase = BattlePhase.Finished;
        const [left, right] = this.state.fighters;
        this.state.winner = left!.hp === right!.hp ? -1 : left!.hp > right!.hp ? 0 : 1;
        for (const fighter of this.state.fighters) {
            this.setAction(fighter, fighter.id === this.state.winner ? FighterAction.Victory : FighterAction.Dead);
        }
        this.state.projectiles.length = 0;
        this.actions.clear();
        this.events.push({ type: BattleEventType.Finish, actor: this.state.winner });
        return true;
    }

    private startTimedStep(step: BattleActionStep, action: FighterAction, duration: number, actionWeapon = this.actor.weapon) {
        step.startedFrame = this.state.tick;
        step.endFrame = this.state.tick + duration;
        this.setAction(this.actor, action, actionWeapon);
        this.actor.readyFrame = step.endFrame;
    }

    private startResolvedStep(step: BattleActionStep, action: FighterAction, windup: number, recovery: number) {
        step.startedFrame = this.state.tick;
        step.resolveFrame = this.state.tick + windup;
        step.endFrame = step.resolveFrame + recovery;
        step.resolved = false;
        this.setAction(this.actor, action);
        this.actor.readyFrame = step.endFrame;
    }

    private setAction(fighter: FighterState, action: FighterAction, actionWeapon = fighter.weapon) {
        if (fighter.action === action && fighter.actionWeapon === actionWeapon) return false;
        fighter.action = action;
        fighter.actionWeapon = actionWeapon;
        fighter.actionFrame = this.state.tick;
        return true;
    }

    private weapon(id: WeaponId) {
        const value = this.config.weapons.get(id);
        if (!value) throw new Error("缺少武器配置：" + id);
        return value;
    }

    private skill(id: SkillId) {
        const value = this.config.skills.get(id);
        if (!value) throw new Error("缺少技能配置：" + id);
        return value;
    }

    private get actor() {
        return this.state.fighters[this.state.activePlayer]!;
    }

    private get target() {
        return this.state.fighters[1 - this.state.activePlayer]!;
    }
}
