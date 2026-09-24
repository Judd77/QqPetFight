import { instantiate } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattleInfo, BattleStepResult, FighterAction } from "../common/GameplayTypes";
import { WeaponAudio } from "./WeaponAudio";
import { WeaponCellComponent } from "./WeaponCellComponent";

/** 武器业务入口：负责动态武器格与角色放下武器后的地面表现。 */
export class WeaponController extends BaseController<GameplayView> {
    private readonly cells: WeaponCellComponent[][] = [[], []];
    private readonly audio = new WeaponAudio(this.view);

    /** 根据本场服务数据创建玩家武器格。 */
    prepare(info: BattleInfo) {
        this.clearCells();
        const view = this.view.config.view;
        for (const fighter of info.fighters) {
            if (fighter.npcId !== undefined) continue;
            const parent = this.view.component.players[fighter.id]!.weapons;
            for (const weaponId of fighter.weapons) {
                const node = instantiate(this.view.assetCtrl.weaponCellPrefab);
                const cell = node.getComponent(WeaponCellComponent)!;
                cell.init();
                cell.weaponId = weaponId;
                cell.icon.spriteFrame = this.view.assetCtrl.getWeaponFrame(weaponId);
                const size = cell.icon.spriteFrame.originalSize;
                const scale = Math.min(view.weaponIconWidth / size.width, view.weaponIconHeight / size.height);
                node.setScale(scale, scale, 1);
                node.name = "Weapon " + weaponId;
                node.parent = parent;
                this.cells[fighter.id]!.push(cell);
            }
        }
    }

    /** 服务帧执行后刷新武器库存显示。 */
    onStep(result: BattleStepResult) {
        this.audio.onStep(result);
        const view = this.view.config.view;
        for (const fighter of result.state.fighters) {
            let visibleIndex = 0;
            const direction = fighter.id === 0 ? 1 : -1;
            for (const cell of this.cells[fighter.id]!) {
                cell.node.active = fighter.inventory.includes(cell.weaponId);
                if (!cell.node.active) continue;
                cell.node.setPosition(
                    direction * (view.cellStartX + visibleIndex % view.cellColumns * view.cellSpacingX),
                    -Math.floor(visibleIndex / view.cellColumns) * view.cellSpacingY,
                );
                visibleIndex++;
            }
        }
    }

    /** 隐藏上一场战斗遗留的地面武器节点。 */
    reset() {
        this.audio.reset();
        for (const ground of this.view.component.groundWeapons) ground.node.active = false;
    }

    /** 根据确定性角色状态刷新地面武器。 */
    protected override onUpdate() {
        const lockstep = this.view.context.lockstep;
        if (!lockstep || this.view.context.loading) return;
        const component = this.view.component;
        const view = this.view.config.view;
        const defaultWeapon = this.view.config.battle.rules.defaultWeapon;
        for (const fighter of lockstep.state.fighters) {
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

    /** 退出玩法时销毁本次动态创建的武器格节点。 */
    protected override onUnload() {
        this.clearCells();
    }

    /** 销毁并清空所有动态武器格。 */
    private clearCells() {
        for (const cells of this.cells) {
            for (const cell of cells) cell.node.destroy();
            cells.length = 0;
        }
    }
}
