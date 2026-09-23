import { Color, Sprite } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import {
    BattleEventType, BattlePhase, BattleState, BattleStepResult, FighterAction, WeaponId,
} from "../battle/BattleTypes";
import { RoleRenderer } from "../presentation/RoleRenderer";

/** 只负责战场节点、角色动画、投射物、落地武器、飘字和角色层级。 */
export class StageController extends BaseController<GameplayView> {
    private readonly roles = [new RoleRenderer(), new RoleRenderer()];
    private readonly damageTime = [0, 0];
    private prepared = false;
    private finishElapsed = 0;

    prepare() {
        // View 会复用，但场景节点每次进入都会重建。
        const component = this.view.component;
        for (let index = 0; index < this.roles.length; index++) {
            this.roles[index]!.init(component.actors[index]!, component.actorSprites[index]!);
        }
        component.projectile.sizeMode = Sprite.SizeMode.RAW;
        this.prepared = true;
    }

    protected override onUnload() {
        this.prepared = false;
    }

    onStep(result: BattleStepResult) {
        const component = this.view.component;
        const view = this.view.config.view;
        for (const event of result.events) {
            if (event.target === undefined ||
                ![BattleEventType.Hit, BattleEventType.Dodge, BattleEventType.Block, BattleEventType.Heal].includes(event.type)) {
                continue;
            }
            const label = component.damageLabels[event.target]!;
            if (event.type === BattleEventType.Heal) {
                label.string = view.healPrefix + (event.damage ?? 0);
                label.color = Color.fromHEX(new Color(), view.healColor);
            } else if (event.type === BattleEventType.Dodge) {
                label.string = view.dodgeText;
                label.color = Color.fromHEX(new Color(), view.damageColor);
            } else if (event.type === BattleEventType.Block) {
                label.string = view.blockText;
                label.color = Color.fromHEX(new Color(), view.damageColor);
            } else {
                label.string = view.damagePrefix + (event.damage ?? 0);
                label.color = Color.fromHEX(new Color(), event.critical ? view.criticalColor : view.damageColor);
            }
            const target = result.state.fighters[event.target]!;
            label.node.setPosition(target.x, view.damageY);
            label.node.active = true;
            this.damageTime[event.target] = view.damageDuration;
        }
    }

    reset() {
        this.finishElapsed = 0;
        this.damageTime.fill(0);
        for (const role of this.roles) role.reset();
        for (const label of this.view.component.damageLabels) label.node.active = false;
        for (const ground of this.view.component.groundWeapons) ground.node.active = false;
        this.view.component.projectile.node.active = false;
    }

    protected override onUpdate(dt: number) {
        const session = this.view.context.session;
        if (!session || !this.prepared || this.view.context.loading) return;
        const speed = session.paused ? 0 : session.speed;
        if (session.state.phase === BattlePhase.Finished) this.finishElapsed += dt * speed;
        this.renderActors(session.state, session.interpolationAlpha);
        this.renderGroundWeapons(session.state);
        this.renderProjectile(session.state, session.interpolationAlpha);
        this.renderDamage(dt * speed);
    }

    private renderActors(state: BattleState, alpha: number) {
        this.updateActorOrder(state.activePlayer);
        for (const fighter of state.fighters) {
            this.roles[fighter.id]!.render(
                state,
                fighter,
                this.view.context.info!.fighters[fighter.id]!,
                alpha,
                this.finishElapsed,
                this.view.config,
                this.view.assetCtrl,
            );
        }
    }

    private renderGroundWeapons(state: BattleState) {
        const component = this.view.component;
        const view = this.view.config.view;
        const defaultWeapon = this.view.config.battle.rules.defaultWeapon;
        for (const fighter of state.fighters) {
            const ground = component.groundWeapons[fighter.id]!;
            ground.node.active = fighter.stowedWeapon !== defaultWeapon && fighter.action !== FighterAction.PutDown;
            if (!ground.node.active) continue;
            ground.spriteFrame = this.view.assetCtrl.getWeaponFrame(fighter.stowedWeapon);
            const size = ground.spriteFrame.originalSize;
            const scale = Math.min(view.groundMaxWidth / size.width, view.groundMaxHeight / size.height);
            ground.node.setScale(scale, scale, 1);
            ground.node.setPosition(fighter.x + fighter.facing * view.groundOffsetX, view.groundY);
            ground.node.angle = fighter.facing * view.groundAngle;
        }
    }

    private renderProjectile(state: BattleState, alpha: number) {
        const projectile = state.projectiles[0];
        const sprite = this.view.component.projectile;
        sprite.node.active = !!projectile;
        if (!projectile) return;
        const view = this.view.config.view;
        const weapon = this.view.config.getWeapon(projectile.weapon);
        const progress = Math.max(0, Math.min(
            1,
            (state.tick - projectile.startFrame + alpha) / (projectile.endFrame - projectile.startFrame),
        ));
        sprite.spriteFrame = this.view.assetCtrl.getWeaponFrame(projectile.weapon);
        const size = sprite.spriteFrame.originalSize;
        const scale = Math.min(view.projectileMaxWidth / size.width, view.projectileMaxHeight / size.height);
        sprite.node.setScale(scale, scale, 1);
        sprite.node.setPosition(
            projectile.startX + (projectile.endX - projectile.startX) * progress,
            view.projectileY + Math.sin(progress * Math.PI) * weapon.projectileArc,
        );
        sprite.node.angle = weapon.projectileRotation === 0
            ? (projectile.endX >= projectile.startX ? 0 : 180)
            : -progress * weapon.projectileRotation;
    }

    private renderDamage(dt: number) {
        const view = this.view.config.view;
        for (let index = 0; index < this.damageTime.length; index++) {
            if (this.damageTime[index]! <= 0) continue;
            this.damageTime[index] = Math.max(0, this.damageTime[index]! - dt);
            const node = this.view.component.damageLabels[index]!.node;
            node.setPosition(node.position.x, node.position.y + dt * view.damageRiseSpeed);
            node.active = this.damageTime[index]! > 0;
        }
    }

    private updateActorOrder(activePlayer: number) {
        const actors = this.view.component.actors;
        const attacker = actors[activePlayer]!;
        const defender = actors[1 - activePlayer]!;
        const attackerIndex = attacker.getSiblingIndex();
        const defenderIndex = defender.getSiblingIndex();
        if (attackerIndex > defenderIndex) return;
        attacker.setSiblingIndex(defenderIndex);
        defender.setSiblingIndex(attackerIndex);
    }
}
