import { instantiate } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import {
    BattleEventType, BattleInfo, BattlePhase, BattleState, BattleStepResult, SkillId, WeaponId,
} from "../battle/BattleTypes";
import { SkillCellComponent } from "../skill/SkillCellComponent";
import { WeaponCellComponent } from "../weapon/WeaponCellComponent";

/** 负责 HUD 数据和动态格子；不加载资源、不计算战斗结果。 */
export class UiController extends BaseController<GameplayView> {
    private readonly weaponCells: WeaponCellComponent[][] = [[], []];
    private readonly skillCells: SkillCellComponent[][] = [[], []];
    private actionExpires = 0;
    private finishElapsed = 0;
    private resultRequested = false;

    prepare(info: BattleInfo) {
        this.clearCells();
        const view = this.view.config.view;
        for (const fighter of info.fighters) {
            const player = this.view.component.players[fighter.id]!;
            player.portrait.spriteFrame = this.view.assetCtrl.getPortrait(fighter);
            const portraitSize = player.portrait.spriteFrame.originalSize;
            const portraitScale = view.portraitSize / Math.max(portraitSize.width, portraitSize.height);
            player.portrait.node.setScale(portraitScale, portraitScale, 1);

            const showLoadout = fighter.npcId === undefined;
            player.weapons.active = showLoadout;
            player.skills.active = showLoadout;
            if (!showLoadout) continue;

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
                node.parent = player.weapons;
                this.weaponCells[fighter.id]!.push(cell);
            }
            for (const skillInfo of fighter.skills) {
                const node = instantiate(this.view.assetCtrl.skillCellPrefab);
                const cell = node.getComponent(SkillCellComponent)!;
                cell.init();
                cell.skillId = skillInfo.id;
                cell.icon.spriteFrame = this.view.assetCtrl.getSkillFrame(skillInfo.id);
                const size = cell.icon.spriteFrame.originalSize;
                const scale = view.skillIconSize / Math.max(size.width, size.height);
                node.setScale(scale, scale, 1);
                node.name = "Skill " + skillInfo.id;
                node.parent = player.skills;
                this.skillCells[fighter.id]!.push(cell);
            }
        }
        this.layoutSkillCells();
    }

    onStep(result: BattleStepResult) {
        const view = this.view.config.view;
        for (const event of result.events) {
            let text: string | undefined;
            if (event.type === BattleEventType.Skill) text = this.view.config.getSkill(event.skill!).name;
            else if (event.type === BattleEventType.PutDown) {
                text = this.view.config.format(view.putDownText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.PickUp) {
                text = this.view.config.format(view.pickUpText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.Equip) {
                text = this.view.config.format(view.equipText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.Throw) {
                text = this.view.config.format(view.throwText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.Attack) {
                text = this.view.config.getWeapon(event.weapon ?? this.view.config.battle.rules.defaultWeapon).name;
            }
            if (!text) continue;
            this.view.component.actionLabel.string = text;
            this.actionExpires = result.state.tick + view.actionDurationFrames;
        }
        this.renderInventory(result.state);
        this.renderSkills(result.state);
    }

    reset() {
        this.resultRequested = false;
        this.finishElapsed = 0;
        this.actionExpires = 0;
        this.view.component.actionLabel.string = "";
    }

    onClickSpeed() {
        this.view.battleCtrl.toggleSpeed();
    }

    protected override onUpdate(dt: number) {
        const session = this.view.context.session;
        if (!session) return;
        const state = session.state;
        const component = this.view.component;
        const rules = this.view.config.battle.rules;
        component.speedButton.active = !session.finished;
        for (const fighter of state.fighters) {
            const ui = component.players[fighter.id]!;
            ui.hp.fillRange = fighter.hp / fighter.maxHp * (fighter.id === 0 ? 1 : -1);
            ui.health.string = fighter.hp + "/" + fighter.maxHp;
            ui.name.string = this.view.context.info!.fighters[fighter.id]!.name;
        }
        component.roundLabel.string = state.phase === BattlePhase.Countdown
            ? String(Math.max(1, Math.ceil((rules.countdownFrames - state.tick) / rules.frameRate)))
            : this.view.config.format(this.view.config.view.roundText, state.round);
        if (state.tick > this.actionExpires) component.actionLabel.string = "";
        if (session.finished && !session.paused) this.finishElapsed += dt * session.speed;
        if (session.finished && this.finishElapsed > this.view.config.view.resultDelay &&
            !this.resultRequested && !this.view.context.loading) {
            this.resultRequested = true;
            void this.view.openResult().catch((error) => {
                console.error(error);
                component.actionLabel.string = this.view.config.view.loadErrorText;
                this.actionExpires = Number.MAX_SAFE_INTEGER;
            });
        }
    }

    protected override onUnload() {
        this.clearCells();
    }

    private renderInventory(state: BattleState) {
        const view = this.view.config.view;
        for (const fighter of state.fighters) {
            let visibleIndex = 0;
            const direction = fighter.id === 0 ? 1 : -1;
            for (const cell of this.weaponCells[fighter.id]!) {
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

    private renderSkills(state: BattleState) {
        for (const fighter of state.fighters) {
            for (const cell of this.skillCells[fighter.id]!) {
                cell.icon.grayscale = fighter.usedSkills.includes(cell.skillId);
            }
        }
    }

    private layoutSkillCells() {
        const view = this.view.config.view;
        for (let fighter = 0; fighter < this.skillCells.length; fighter++) {
            const direction = fighter === 0 ? 1 : -1;
            this.skillCells[fighter]!.forEach((cell, index) => {
                cell.node.setPosition(
                    direction * (view.cellStartX + index % view.cellColumns * view.cellSpacingX),
                    -Math.floor(index / view.cellColumns) * view.cellSpacingY,
                );
            });
        }
    }

    private clearCells() {
        for (const cells of this.weaponCells) {
            for (const cell of cells) cell.node.destroy();
            cells.length = 0;
        }
        for (const cells of this.skillCells) {
            for (const cell of cells) cell.node.destroy();
            cells.length = 0;
        }
    }
}
