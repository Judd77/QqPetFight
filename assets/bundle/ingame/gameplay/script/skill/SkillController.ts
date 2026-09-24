import { instantiate } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattleInfo, BattleStepResult } from "../model/GameplayTypes";
import { SkillAudio } from "./SkillAudio";
import { SkillCellComponent } from "./SkillCellComponent";

/** 技能业务入口：负责根据服务数据创建技能格并刷新消耗状态。 */
export class SkillController extends BaseController<GameplayView> {
    private readonly cells: SkillCellComponent[][] = [[], []];
    private readonly audio = new SkillAudio(this.view);

    /** 根据本场服务数据创建玩家技能格。 */
    prepare(info: BattleInfo) {
        this.clearCells();
        const view = this.view.config.view;
        for (const fighter of info.fighters) {
            if (fighter.npcId !== undefined) continue;
            const parent = this.view.component.players[fighter.id]!.skills;
            const direction = fighter.id === 0 ? 1 : -1;
            fighter.skills.forEach((skillInfo, index) => {
                const node = instantiate(this.view.assetCtrl.skillCellPrefab);
                const cell = node.getComponent(SkillCellComponent)!;
                cell.init();
                cell.skillId = skillInfo.id;
                cell.icon.spriteFrame = this.view.assetCtrl.getSkillFrame(skillInfo.id);
                const size = cell.icon.spriteFrame.originalSize;
                const scale = view.skillIconSize / Math.max(size.width, size.height);
                node.setScale(scale, scale, 1);
                node.setPosition(
                    direction * (view.cellStartX + index % view.cellColumns * view.cellSpacingX),
                    -Math.floor(index / view.cellColumns) * view.cellSpacingY,
                );
                node.name = "Skill " + skillInfo.id;
                node.parent = parent;
                this.cells[fighter.id]!.push(cell);
            });
        }
    }

    /** 服务帧执行后刷新不可重复技能的消耗状态。 */
    onStep(result: BattleStepResult) {
        this.audio.onStep(result);
        for (const fighter of result.state.fighters) {
            for (const cell of this.cells[fighter.id]!) {
                cell.icon.grayscale = fighter.usedSkills.includes(cell.skillId);
            }
        }
    }

    /** 清空上一场技能音效的帧去重状态。 */
    reset() {
        this.audio.reset();
    }

    /** 退出玩法时销毁本次动态创建的技能格节点。 */
    protected override onUnload() {
        this.clearCells();
    }

    /** 销毁并清空所有动态技能格。 */
    private clearCells() {
        for (const cells of this.cells) {
            for (const cell of cells) cell.node.destroy();
            cells.length = 0;
        }
    }
}
