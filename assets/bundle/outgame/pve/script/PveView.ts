import { instantiate, Label, Prefab, Sprite, SpriteFrame } from "cc";
import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import { AssetStore } from "db://assets/bundle/shared/script/asset/AssetStore";
import { LocalPlayerGateway } from "db://assets/bundle/shared/script/player/PlayerGateway";
import type { PveComponent } from "./PveComponent";
import { PveCampaign } from "./PveCampaign";

/** PVE 对手预览总入口。 */
export class PveView extends BaseView<PveComponent> {
    private get campaign() { return this.serve.getService(PveCampaign); }
    private busy = false;
    private stageId = 0;

    protected override async onLoad() {
        await this.show();
    }

    /** 读取当前关卡并填充对手资料与动态配装。 */
    private async show() {
        const component = this.component;
        this.busy = true;
        component.challenge.interactable = false;
        component.message.string = "正在读取关卡…";
        try {
            const tables = this.serve.configService.tables;
            const stage = this.campaign.getCurrent(tables);
            this.stageId = stage.id;
            const total = this.campaign.getStages(tables).length;
            const cleared = this.campaign.getCleared();
            component.title.string = "江湖闯关 · 第 " + stage.id + " 关";
            component.progress.string = "已通关 " + Math.min(cleared, total) + " / " + total;
            component.nameLabel.string = stage.name;
            component.health.string = "生命 " + stage.hp;
            component.description.string = stage.description;
            component.challengeLabel.string = cleared >= total ? "再次挑战" : "挑 战";
            const portrait = await this.loadFrame(stage.portrait);
            component.portrait.spriteFrame = portrait;
            const portraitScale = 150 / Math.max(portrait.originalSize.width, portrait.originalSize.height);
            component.portrait.node.setScale(portraitScale, portraitScale, 1);
            const itemPrefab = await this.serve.getService(AssetStore).load(
                this.serve.assetService, "outgame/pve/prefab/EquipmentItem", Prefab);
            for (const root of [component.weapons, component.skills]) {
                for (const node of root.children.slice()) node.destroy();
            }
            const groups = [
                { root: component.weapons, items: stage.weapons.map(id => tables.TbWeapon.get(id)!) },
                { root: component.skills, items: stage.skills.map(id => tables.TbSkill.get(id)!) },
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
            component.message.string = cleared >= total ? "十关已全部通关，可以再次切磋。" : "击败对手，解锁下一关";
            component.challenge.interactable = true;
        } catch (error) {
            console.error(error);
            component.message.string = "读取失败，请关闭后重试";
        } finally {
            this.busy = false;
        }
    }

    /** 创建当前关卡战斗数据并打开加载页。 */
    async challenge() {
        if (this.busy || !this.component.challenge.interactable) return;
        this.busy = true;
        this.component.challenge.interactable = false;
        this.component.close.interactable = false;
        try {
            const battle = await this.campaign.createBattle(this.stageId, this.serve.configService.tables,
                this.serve.getService(LocalPlayerGateway));
            await this.serve.viewService.load(ViewKeys.Loading, battle);
            this.serve.viewService.unload(ViewKeys.Pve);
        } catch (error) {
            console.error(error);
            if (this.isLoaded) this.component.message.string = "挑战加载失败，请重试";
        } finally {
            this.busy = false;
            if (this.isLoaded) {
                this.component.challenge.interactable = true;
                this.component.close.interactable = true;
            }
        }
    }

    /** 非加载状态下关闭对手预览。 */
    close() {
        if (!this.busy) this.serve.viewService.unload(ViewKeys.Pve);
    }

    /** 加载并长期缓存对手头像、武器和技能图标。 */
    private async loadFrame(path: string) {
        return this.serve.getService(AssetStore).load(this.serve.assetService, path, SpriteFrame);
    }
}
