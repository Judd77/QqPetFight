import { instantiate, Label, Prefab, Sprite, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { PveView } from "./PveView";
import { PveCampaign } from "./PveCampaign";

const frames = new Map<string, SpriteFrame>();
let itemPrefab: Prefab | undefined;

/** 对手资料、动态配装列表以及挑战入口。 */
export class PveController extends BaseController<PveView> {
    private readonly campaign = new PveCampaign();
    private busy = false;
    private stageId = 0;

    async show() {
        const ui = this.view.component;
        this.busy = true;
        ui.challenge.interactable = false;
        ui.message.string = "正在读取关卡…";
        try {
            const tables = this.view.serve.configService.tables;
            const stage = this.campaign.getCurrent(tables);
            this.stageId = stage.id;
            const total = this.campaign.getStages(tables).length;
            const cleared = this.campaign.getCleared();
            ui.title.string = "江湖闯关 · 第 " + stage.id + " 关";
            ui.progress.string = "已通关 " + Math.min(cleared, total) + " / " + total;
            ui.nameLabel.string = stage.name;
            ui.health.string = "生命 " + stage.hp;
            ui.description.string = stage.description;
            ui.challengeLabel.string = cleared >= total ? "再次挑战" : "挑 战";
            const portrait = await this.loadFrame(stage.portrait);
            ui.portrait.spriteFrame = portrait;
            const scale = 150 / Math.max(portrait.originalSize.width, portrait.originalSize.height);
            ui.portrait.node.setScale(scale, scale, 1);
            if (!itemPrefab) {
                itemPrefab = await this.view.serve.assetService.load("ingame/pve/prefab/EquipmentItem", Prefab);
                itemPrefab.addRef();
            }
            for (const root of [ui.weapons, ui.skills]) {
                for (const node of root.children.slice()) node.destroy();
            }
            const groups = [
                { root: ui.weapons, items: stage.weapons.map(id => tables.TbWeapon.get(id)!) },
                { root: ui.skills, items: stage.skills.map(id => tables.TbSkill.get(id)!) },
            ];
            for (const group of groups) {
                for (let index = 0; index < group.items.length; index++) {
                    const item = group.items[index]!;
                    if (!item) throw new Error("关卡配装配置不存在");
                    const frame = await this.loadFrame(item.iconPath);
                    const node = instantiate(itemPrefab);
                    node.parent = group.root;
                    node.setPosition(index % 5 * 96, -Math.floor(index / 5) * 84);
                    node.getChildByName("Name")!.getComponent(Label)!.string = item.name;
                    const icon = node.getChildByName("Icon")!.getComponent(Sprite)!;
                    icon.spriteFrame = frame;
                    const size = frame.originalSize;
                    const scale = Math.min(48 / size.width, 44 / size.height);
                    icon.node.setScale(scale, scale, 1);
                }
            }
            ui.message.string = cleared >= total ? "十关已全部通关，可以再次切磋。" : "击败对手，解锁下一关";
            ui.challenge.interactable = true;
        } catch (error) {
            console.error(error);
            ui.message.string = "读取失败，请关闭后重试";
        } finally {
            this.busy = false;
        }
    }

    async challenge() {
        if (this.busy || !this.view.component.challenge.interactable) return;
        this.busy = true;
        const ui = this.view.component;
        ui.challenge.interactable = false;
        ui.close.interactable = false;
        try {
            const battle = await this.campaign.createBattle(this.stageId, this.view.serve.configService.tables);
            await this.view.serve.viewService.load(ViewKeys.Loading, battle);
            this.view.serve.viewService.unload(ViewKeys.Pve);
        } catch (error) {
            console.error(error);
            if (this.view.isLoaded) ui.message.string = "挑战加载失败，请重试";
        } finally {
            this.busy = false;
            if (this.view.isLoaded) {
                ui.challenge.interactable = true;
                ui.close.interactable = true;
            }
        }
    }

    close() {
        if (!this.busy) this.view.serve.viewService.unload(ViewKeys.Pve);
    }

    private async loadFrame(path: string) {
        const cached = frames.get(path);
        if (cached) return cached;
        const frame = await this.view.serve.assetService.load(path, SpriteFrame);
        frame.addRef();
        frames.set(path, frame);
        return frame;
    }
}
