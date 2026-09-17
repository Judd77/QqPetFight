import { instantiate, Prefab, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleWorld } from "../battle/BattleWorld";
import { BattleInfo, WeaponId, WEAPONS } from "../battle/BattleTypes";
import { WeaponCellComponent } from "./WeaponCellComponent";

/** 按对战数据创建武器项，维护库存显示与武器图片引用。 */
export class WeaponController extends BaseController<GameplayView> {
    private declare cellPrefab: Prefab;
    private readonly frames = new Map<WeaponId, SpriteFrame>();
    private readonly cells: WeaponCellComponent[][] = [[], []];

    /** 加载不包含具体武器图片的通用预制体。 */
    protected override async onLoad() {
        this.view.component.weaponFrames = this.frames;
        if (this.cellPrefab) return;
        this.cellPrefab = await this.view.serve.assetService.load("ingame/gameplay/prefab/WeaponCell", Prefab);
        this.cellPrefab.addRef();
    }

    /** 只加载响应中实际出现的武器，待资源齐全后创建列表。 */
    async prepare(info: BattleInfo) {
        const frames = this.view.component.weaponFrames;
        const ids = Array.from(new Set(info.fighters.flatMap((fighter) => fighter.weapons)));
        const results = await Promise.allSettled(ids.map(async (id) => {
            if (frames.has(id)) return;
            const frame = await this.view.serve.assetService.load(
                "ingame/gameplay/texture/weapon/" + WEAPONS[id].icon + "/spriteFrame", SpriteFrame);
            frame.addRef();
            frames.set(id, frame);
        }));
        const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
        this.clearCells();
        for (const fighter of info.fighters) {
            const root = this.view.component.players[fighter.id]!.weapons;
            for (const id of fighter.weapons) {
                const node = instantiate(this.cellPrefab);
                const cell = node.getComponent(WeaponCellComponent)!;
                cell.init();
                cell.weaponId = id;
                cell.icon.spriteFrame = frames.get(id)!;
                const size = cell.icon.spriteFrame.originalSize;
                const scale = Math.min(52 / size.width, 44 / size.height);
                node.setScale(scale, scale, 1);
                node.name = "Weapon " + id;
                node.parent = root;
                this.cells[fighter.id]!.push(cell);
            }
        }
    }

    /** 库存消耗后收起对应项，并按原有顺序排列剩余武器。 */
    render(world: BattleWorld) {
        for (const fighter of world.fighters) {
            let index = 0;
            const direction = fighter.id === 0 ? 1 : -1;
            for (const cell of this.cells[fighter.id]!) {
                cell.node.active = fighter.inventory.includes(cell.weaponId);
                if (!cell.node.active) continue;
                cell.node.setPosition(direction * (26 + index % 7 * 58), -Math.floor(index / 7) * 50);
                index++;
            }
        }
    }

    /** 只回收本控制器动态生成的武器项，保留场景容器。 */
    private clearCells() {
        for (const cells of this.cells) {
            for (const cell of cells) cell.node.destroy();
            cells.length = 0;
        }
    }

    /** 只清理动态节点，已加载资源留在控制器中供下次进入复用。 */
    protected override onUnload() {
        this.clearCells();
    }
}
