import { Sprite } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";

/** 投射物业务入口：负责远程武器的飞行插值和旋转表现。 */
export class ProjectileController extends BaseController<GameplayView> {
    /** 初始化投射物图片显示模式。 */
    prepare() {
        this.view.component.projectile.sizeMode = Sprite.SizeMode.RAW;
    }

    /** 隐藏上一场战斗遗留的投射物。 */
    reset() {
        this.view.component.projectile.node.active = false;
    }

    /** 根据确定性投射物状态刷新画面。 */
    protected override onUpdate() {
        const lockstep = this.view.context.lockstep;
        if (!lockstep || this.view.context.loading) return;
        const state = lockstep.state;
        const projectile = state.projectiles[0];
        const sprite = this.view.component.projectile;
        sprite.node.active = !!projectile;
        if (!projectile) return;

        const view = this.view.config.view;
        const weapon = this.view.config.getWeapon(projectile.weapon);
        const progress = Math.max(0, Math.min(
            1,
            (state.tick - projectile.startFrame + lockstep.interpolationAlpha) /
                (projectile.endFrame - projectile.startFrame),
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
}
