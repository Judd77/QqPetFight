import { BattleActionQueue, BattleActionStep, BattleActionStepType } from "./BattleActionQueue";
import {
    BattleCommand, BattleCommandType, BattleDefinitions, BattleEvent, BattleEventType, BattleInfo, BattleIntent, BattlePhase,
    BattleReaction, BattleResolution, BattleState, BattleStepResult, FighterAction, FighterState, ServiceFrame,
    SkillEffect, SkillId, WeaponId,
} from "./BattleTypes";

/** 纯 TypeScript 确定性战斗内核：只消费服务帧并输出状态与事件。 */
export class BattleEngine {
    readonly info: BattleInfo;
    readonly state: BattleState;
    /** 当前行动拆分后的确定性步骤队列。 */
    readonly actionQueue = new BattleActionQueue();
    private readonly events: BattleEvent[] = [];
    private projectileId = 0;

    constructor(info: BattleInfo, readonly config: BattleDefinitions) {
        this.info = JSON.parse(JSON.stringify(info)) as BattleInfo;
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

    /** 当前帧是否允许接收一条新的服务端行动指令。 */
    get canStartAction() {
        return this.state.phase !== BattlePhase.Finished &&
            this.state.tick >= this.config.rules.countdownFrames &&
            this.actionQueue.isEmpty &&
            this.state.tick >= this.state.nextActionFrame;
    }

    /** 执行一个编号连续的服务帧，并返回本帧状态与表现事件。 */
    executeFrame(frame: ServiceFrame): BattleStepResult {
        if (frame.tick !== this.state.tick + 1) throw new Error("服务帧不连续：" + frame.tick);
        this.state.tick = frame.tick;
        this.events.length = 0;
        for (const fighter of this.state.fighters) fighter.previousX = fighter.x;
        if (this.state.phase === BattlePhase.Finished) return this.createStepResult();

        const rules = this.config.rules;
        if (this.state.tick < rules.countdownFrames) {
            if (this.state.tick % rules.frameRate === 0) {
                this.events.push({ type: BattleEventType.Countdown, actor: -1 });
            }
            return this.createStepResult();
        }
        if (this.state.phase === BattlePhase.Countdown) {
            this.state.phase = BattlePhase.Fighting;
            this.events.push({ type: BattleEventType.Start, actor: -1 });
        }

        this.updateReactionStates();
        this.updateProjectiles();
        if (this.finishBattleIfNeeded()) return this.createStepResult();

        if (this.actionQueue.isEmpty && this.state.tick >= this.state.nextActionFrame) {
            const command = frame.commands[0];
            if (command) this.beginActionCommand(command);
        }
        this.updateCurrentActionStep();
        this.finishBattleIfNeeded();
        return this.createStepResult();
    }

    /** 计算确定性状态校验值，用于比较正常战斗和录像回放结果。 */
    calculateChecksum(): string {
        const source = JSON.stringify({
            state: this.state,
            projectileId: this.projectileId,
            actions: this.actionQueue.createSnapshot(),
        });
        let hash = 2166136261;
        for (let index = 0; index < source.length; index++) {
            hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    /** 组合本帧战斗状态和事件；不复制状态对象。 */
    private createStepResult(): BattleStepResult {
        return { state: this.state, events: this.events };
    }

    /** 把一条服务端行动指令展开成可逐帧执行的步骤队列。 */
    private beginActionCommand(command: BattleCommand) {
        if (command.type !== BattleCommandType.Act || !this.actionQueue.isEmpty) return;
        this.state.activePlayer = command.player;
        const actor = this.actor;
        const target = this.target;
        const steps: BattleActionStep[] = [];
        switch (command.intent) {
            case BattleIntent.Equip: {
                this.assertResolutionTarget(command.resolution, target.id);
                const weapon = command.entryId as WeaponId;
                if (actor.weapon !== this.config.rules.defaultWeapon || !actor.inventory.includes(weapon)) return;
                steps.push({ type: BattleActionStepType.Equip, weapon });
                if (this.getWeaponDefinition(weapon).ranged) {
                    steps.push({ type: BattleActionStepType.Throw, weapon, resolution: command.resolution });
                } else {
                    steps.push({ type: BattleActionStepType.Approach, weapon });
                    steps.push({ type: BattleActionStepType.Attack, weapon, resolution: command.resolution });
                }
                break;
            }
            case BattleIntent.Attack:
                this.assertResolutionTarget(command.resolution, target.id);
                if (this.getWeaponDefinition(actor.weapon).ranged) return;
                steps.push({ type: BattleActionStepType.Approach, weapon: actor.weapon });
                steps.push({ type: BattleActionStepType.Attack, weapon: actor.weapon, resolution: command.resolution });
                break;
            case BattleIntent.Throw:
                this.assertResolutionTarget(command.resolution, target.id);
                if (actor.weapon === this.config.rules.defaultWeapon) return;
                steps.push({ type: BattleActionStepType.Throw, weapon: actor.weapon, resolution: command.resolution });
                break;
            case BattleIntent.Skill: {
                const skillId = command.entryId as SkillId;
                const skill = this.config.skills.get(skillId);
                if (!skill || (!skill.repeatable && actor.usedSkills.includes(skillId)) ||
                    !this.info.fighters[actor.id]!.skills.some((item) => item.id === skillId)) return;
                this.assertResolutionTarget(command.resolution, skill.effect === SkillEffect.Heal ? actor.id : target.id);
                actor.skill = skillId;
                if (!skill.repeatable) actor.usedSkills.push(skillId);
                if (skill.requiresUnarmed && actor.weapon !== this.config.rules.defaultWeapon) {
                    steps.push({ type: BattleActionStepType.PutDown, weapon: actor.weapon });
                }
                if (skill.approach) {
                    steps.push({ type: BattleActionStepType.Approach, weapon: this.config.rules.defaultWeapon });
                }
                steps.push({ type: BattleActionStepType.Skill, skill: skillId, resolution: command.resolution });
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
        this.state.round = command.round;
        actor.combo = command.comboIndex;
        this.actionQueue.startAction(steps);
        if (Math.abs(actor.x - target.x) <= 0) throw new Error("参战者位置重叠");
    }

    /** 推进当前行动步骤，并在步骤完成后切换到下一步。 */
    private updateCurrentActionStep() {
        const step = this.actionQueue.currentStep;
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
                    this.state.projectiles.length === 0) this.actionQueue.advanceToNextStep();
                break;
            case BattleActionStepType.PickUp:
                this.updatePickUp(step);
                break;
            case BattleActionStepType.Return:
                this.updateReturn();
                break;
            case BattleActionStepType.Complete:
                this.completeAction();
                break;
        }
    }

    /** 推进装备武器步骤。 */
    private updateEquip(step: BattleActionStep) {
        const actor = this.actor;
        const weaponId = step.weapon!;
        const weapon = this.getWeaponDefinition(weaponId);
        if (step.startedFrame === undefined) {
            const index = actor.inventory.indexOf(weaponId);
            if (index < 0) throw new Error("装备不在库存中：" + weaponId);
            actor.inventory.splice(index, 1);
            actor.weapon = weaponId;
            this.startTimedStep(step, FighterAction.Equip, weapon.equipFrames);
            this.events.push({ type: BattleEventType.Equip, actor: actor.id, weapon: weaponId });
        }
        if (this.state.tick >= step.endFrame!) this.actionQueue.advanceToNextStep();
    }

    /** 推进接近目标步骤，直到进入武器攻击距离。 */
    private updateApproach(step: BattleActionStep) {
        const actor = this.actor;
        const target = this.target;
        const range = this.getWeaponDefinition(step.weapon!).range;
        const distance = Math.abs(actor.x - target.x);
        if (distance <= range) {
            this.actionQueue.advanceToNextStep();
            return;
        }
        const changed = this.changeFighterAction(actor, FighterAction.Run);
        actor.x += actor.facing * Math.min(this.config.rules.moveSpeed, distance - range);
        if (changed) this.events.push({ type: BattleEventType.Move, actor: actor.id });
    }

    /** 推进近战攻击步骤，并在命中帧应用服务端结算。 */
    private updateAttack(step: BattleActionStep) {
        const actor = this.actor;
        const weapon = this.getWeaponDefinition(step.weapon!);
        if (step.startedFrame === undefined) {
            this.startEffectStep(step, FighterAction.Attack, weapon.windup, weapon.recovery);
            this.events.push({ type: BattleEventType.Attack, actor: actor.id, weapon: weapon.id });
        }
        if (!step.resolved && this.state.tick >= step.resolveFrame!) {
            step.resolved = true;
            actor.attacks++;
            this.applyResolution(actor.id, step.resolution!);
        }
        if (this.state.tick >= step.endFrame!) this.actionQueue.advanceToNextStep();
    }

    /** 推进投掷步骤，并在出手帧创建确定性投射物。 */
    private updateThrow(step: BattleActionStep) {
        const actor = this.actor;
        const target = this.target;
        const weapon = this.getWeaponDefinition(step.weapon!);
        if (step.startedFrame === undefined) {
            this.startEffectStep(step, FighterAction.Throw, weapon.windup, weapon.recovery);
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
                damage: step.resolution!.damage,
                reaction: step.resolution!.reaction,
                critical: step.resolution!.critical,
                startX: actor.x + actor.facing * weapon.projectileOffset,
                endX: target.x,
                startFrame: this.state.tick,
                endFrame: this.state.tick + travel,
            });
            actor.weapon = this.config.rules.defaultWeapon;
        }
        if (this.state.tick >= step.endFrame!) this.actionQueue.advanceToNextStep();
    }

    /** 推进放下武器步骤；动画完成后武器才进入地面状态。 */
    private updatePutDown(step: BattleActionStep) {
        const actor = this.actor;
        const weapon = this.getWeaponDefinition(step.weapon!);
        if (step.startedFrame === undefined) {
            this.startTimedStep(step, FighterAction.PutDown, weapon.putDownFrames, weapon.id);
        }
        if (!step.resolved && this.state.tick >= step.endFrame!) {
            step.resolved = true;
            actor.stowedWeapon = actor.weapon;
            actor.weapon = this.config.rules.defaultWeapon;
            this.events.push({ type: BattleEventType.PutDown, actor: actor.id, weapon: weapon.id });
            this.actionQueue.advanceToNextStep();
        }
    }

    /** 推进技能步骤，并在技能命中帧应用服务端结算。 */
    private updateSkill(step: BattleActionStep) {
        const actor = this.actor;
        const skill = this.getSkillDefinition(step.skill!);
        if (step.startedFrame === undefined) {
            this.startEffectStep(step, FighterAction.Skill, skill.hitFrame, skill.duration - skill.hitFrame);
            this.events.push({ type: BattleEventType.Skill, actor: actor.id, skill: skill.id });
        }
        if (!step.resolved && this.state.tick >= step.resolveFrame!) {
            step.resolved = true;
            actor.attacks++;
            const info = this.info.fighters[actor.id]!.skills.find((item) => item.id === skill.id);
            if (!info) throw new Error("参战数据缺少技能：" + skill.id);
            if (skill.effect === SkillEffect.Heal) {
                const restored = Math.min(step.resolution!.healing, actor.maxHp - actor.hp);
                actor.hp += restored;
                this.events.push({ type: BattleEventType.Heal, actor: actor.id, target: actor.id, damage: restored, skill: skill.id });
            } else {
                this.applyResolution(actor.id, step.resolution!);
            }
        }
        if (this.state.tick >= step.endFrame!) this.actionQueue.advanceToNextStep();
    }

    /** 推进拾取武器步骤，并在动画结束时恢复手持状态。 */
    private updatePickUp(step: BattleActionStep) {
        const actor = this.actor;
        const weapon = this.getWeaponDefinition(step.weapon!);
        if (step.startedFrame === undefined) {
            actor.weapon = actor.stowedWeapon;
            actor.stowedWeapon = this.config.rules.defaultWeapon;
            this.startTimedStep(step, FighterAction.PickUp, weapon.pickUpFrames);
            this.events.push({ type: BattleEventType.PickUp, actor: actor.id, weapon: weapon.id });
        }
        if (this.state.tick >= step.endFrame!) this.actionQueue.advanceToNextStep();
    }

    /** 推进返回出生点步骤，抵达后恢复待机动作。 */
    private updateReturn() {
        const actor = this.actor;
        const home = actor.id === 0 ? this.config.rules.leftStartX : this.config.rules.rightStartX;
        const distance = home - actor.x;
        if (distance === 0) {
            this.changeFighterAction(actor, FighterAction.Idle);
            this.actionQueue.advanceToNextStep();
            return;
        }
        const changed = this.changeFighterAction(actor, FighterAction.Retreat);
        actor.x += Math.sign(distance) * Math.min(this.config.rules.moveSpeed, Math.abs(distance));
        if (changed) this.events.push({ type: BattleEventType.Move, actor: actor.id });
    }

    /** 完成当前行动并设置下一次可行动的逻辑帧。 */
    private completeAction() {
        this.changeFighterAction(this.actor, FighterAction.Idle);
        this.actor.skill = undefined;
        this.actor.combo = 0;
        this.state.nextActionFrame = this.state.tick + this.config.rules.nextTurnDelay;
        this.actionQueue.reset();
    }

    /** 在受击或闪避动作到期后恢复角色待机状态。 */
    private updateReactionStates() {
        for (const fighter of this.state.fighters) {
            if ((fighter.action === FighterAction.Hurt || fighter.action === FighterAction.Dodge) &&
                this.state.tick >= fighter.readyFrame) this.changeFighterAction(fighter, FighterAction.Idle);
        }
    }

    /** 推进投射物，并在到达目标帧应用已确定的命中结果。 */
    private updateProjectiles() {
        for (let index = this.state.projectiles.length - 1; index >= 0; index--) {
            const projectile = this.state.projectiles[index]!;
            if (this.state.tick < projectile.endFrame) continue;
            this.applyResolution(projectile.owner, {
                target: projectile.target,
                reaction: projectile.reaction,
                damage: projectile.damage,
                healing: 0,
                critical: projectile.critical,
            });
            this.state.projectiles.splice(index, 1);
        }
    }

    /** 将服务端给出的治疗、闪避、格挡或伤害结果写入战斗状态。 */
    private applyResolution(attackerId: number, resolution: BattleResolution) {
        const attacker = this.state.fighters[attackerId]!;
        const target = this.state.fighters[resolution.target]!;
        if (resolution.reaction === BattleReaction.Dodge) {
            target.dodges++;
            this.changeFighterAction(target, FighterAction.Dodge);
            target.readyFrame = this.state.tick + this.config.rules.dodgeFrames;
            this.events.push({ type: BattleEventType.Dodge, actor: attackerId, target: target.id });
            return;
        }
        if (resolution.reaction === BattleReaction.Block) {
            this.events.push({ type: BattleEventType.Block, actor: attackerId, target: target.id });
            return;
        }
        if (resolution.reaction !== BattleReaction.Hit) return;
        const applied = Math.min(target.hp, resolution.damage);
        target.hp -= applied;
        attacker.damageDealt += applied;
        this.changeFighterAction(target, FighterAction.Hurt);
        target.readyFrame = this.state.tick + this.config.rules.hurtFrames;
        this.events.push({
            type: BattleEventType.Hit,
            actor: attackerId,
            target: target.id,
            damage: applied,
            critical: resolution.critical,
        });
    }

    /** 检查生命值并在首次出现败者时结束战斗。 */
    private finishBattleIfNeeded() {
        if (this.state.fighters.every((fighter) => fighter.hp > 0) && this.state.tick < this.config.rules.maxFrames) return false;
        this.state.phase = BattlePhase.Finished;
        const [left, right] = this.state.fighters;
        this.state.winner = left!.hp === right!.hp ? -1 : left!.hp > right!.hp ? 0 : 1;
        for (const fighter of this.state.fighters) {
            this.changeFighterAction(fighter, fighter.id === this.state.winner ? FighterAction.Victory : FighterAction.Dead);
        }
        this.state.projectiles.length = 0;
        this.actionQueue.reset();
        this.events.push({ type: BattleEventType.Finish, actor: this.state.winner });
        return true;
    }

    /** 初始化一个只有开始帧和结束帧的定时步骤。 */
    private startTimedStep(step: BattleActionStep, action: FighterAction, duration: number, actionWeapon = this.actor.weapon) {
        step.startedFrame = this.state.tick;
        step.endFrame = this.state.tick + duration;
        this.changeFighterAction(this.actor, action, actionWeapon);
        this.actor.readyFrame = step.endFrame;
    }

    /** 初始化一个包含命中帧和收招帧的行动步骤。 */
    private startEffectStep(step: BattleActionStep, action: FighterAction, windup: number, recovery: number) {
        step.startedFrame = this.state.tick;
        step.resolveFrame = this.state.tick + windup;
        step.endFrame = step.resolveFrame + recovery;
        step.resolved = false;
        this.changeFighterAction(this.actor, action);
        this.actor.readyFrame = step.endFrame;
    }

    /** 切换角色动作并重置动作起始帧；返回动作是否实际改变。 */
    private changeFighterAction(fighter: FighterState, action: FighterAction, actionWeapon = fighter.weapon) {
        if (fighter.action === action && fighter.actionWeapon === actionWeapon) return false;
        fighter.action = action;
        fighter.actionWeapon = actionWeapon;
        fighter.actionFrame = this.state.tick;
        return true;
    }

    /** 防止服务端结算目标与当前行动目标不一致。 */
    private assertResolutionTarget(resolution: BattleResolution, target: number) {
        if (resolution.target !== target) throw new Error("战报目标无效");
    }

    /** 获取武器定义；配置缺失时立即终止战斗，避免产生非确定状态。 */
    private getWeaponDefinition(id: WeaponId) {
        const value = this.config.weapons.get(id);
        if (!value) throw new Error("缺少武器配置：" + id);
        return value;
    }

    /** 获取技能定义；配置缺失时立即终止战斗，避免产生非确定状态。 */
    private getSkillDefinition(id: SkillId) {
        const value = this.config.skills.get(id);
        if (!value) throw new Error("缺少技能配置：" + id);
        return value;
    }

    /** 当前行动方状态。 */
    private get actor() {
        return this.state.fighters[this.state.activePlayer]!;
    }

    /** 当前受击方状态。 */
    private get target() {
        return this.state.fighters[1 - this.state.activePlayer]!;
    }
}
