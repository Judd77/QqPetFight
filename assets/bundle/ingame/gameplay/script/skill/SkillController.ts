import { instantiate, Prefab, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleWorld } from "../battle/BattleWorld";
import { BattleInfo, SkillId, SKILLS } from "../battle/BattleTypes";
import { SkillCellComponent } from "./SkillCellComponent";

/** 按模拟响应展示双方技能，资源和顺序都由对战数据决定。 */
export class SkillController extends BaseController<GameplayView> {
    private declare cellPrefab: Prefab;
    private readonly frames = new Map<SkillId, SpriteFrame>();
    private readonly cells: SkillCellComponent[][] = [[], []];

    /** 加载没有具体技能图片的通用项。 */
    protected override async onLoad() {
        if (this.cellPrefab) return;
        this.cellPrefab = await this.view.serve.assetService.load("ingame/gameplay/prefab/SkillCell", Prefab);
        this.cellPrefab.addRef();
    }

    /** 仅加载参战者拥有的技能，并在资源齐全后更新列表。 */
    async prepare(info: BattleInfo) {
        const ids = Array.from(new Set(info.fighters.flatMap((fighter) => fighter.skills.map((skill) => skill.id))));
        const results = await Promise.allSettled(ids.map(async (id) => {
            if (this.frames.has(id)) return;
            const frame = await this.view.serve.assetService.load(
                "ingame/gameplay/texture/skill/" + SKILLS[id].clip + "/spriteFrame", SpriteFrame);
            frame.addRef();
            this.frames.set(id, frame);
        }));
        const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
        this.clearCells();
        for (const fighter of info.fighters) {
            const root = this.view.component.players[fighter.id]!.skills;
            fighter.skills.forEach((skill, index) => {
                const node = instantiate(this.cellPrefab);
                const cell = node.getComponent(SkillCellComponent)!;
                cell.init();
                cell.skillId = skill.id;
                cell.icon.spriteFrame = this.frames.get(skill.id)!;
                const size = cell.icon.spriteFrame.originalSize;
                const scale = Math.min(42 / size.width, 42 / size.height);
                node.setScale(scale, scale, 1);
                node.setPosition((fighter.id === 0 ? 1 : -1) * (26 + index % 7 * 58), -Math.floor(index / 7) * 50);
                node.name = "Skill " + skill.id;
                node.parent = root;
                this.cells[fighter.id]!.push(cell);
            });
        }
    }

    /** 已使用的技能置灰，保留原位置，重播时由新状态恢复。 */
    render(world: BattleWorld) {
        for (const fighter of world.fighters) {
            for (const cell of this.cells[fighter.id]!) {
                cell.icon.grayscale = fighter.usedSkills.includes(cell.skillId);
            }
        }
    }

    /** 只回收动态项，不修改场景中的固定容器。 */
    private clearCells() {
        for (const cells of this.cells) {
            for (const cell of cells) cell.node.destroy();
            cells.length = 0;
        }
    }

    /** 只清理动态节点，保留技能图片和通用预制体缓存。 */
    protected override onUnload() {
        this.clearCells();
    }
}
