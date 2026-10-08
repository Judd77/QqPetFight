import { Director, director } from "cc";
import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { AssetStore } from "db://assets/bundle/shared/script/asset/AssetStore";
import { getFighterAssets } from "db://assets/bundle/ingame/gameplay/script/asset/GameplayAssets";
import { GameplayConfig } from "db://assets/bundle/ingame/gameplay/script/model/GameplayConfig";
import { LocalPlayerGateway } from "db://assets/bundle/shared/script/player/PlayerGateway";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { PreloadComponent } from "./PreloadComponent";

/** 启动后加载主角全部可用资源，完成后进入大厅。 */
export class PreloadView extends BaseView<PreloadComponent> {
    private busy = false;

    protected override async onLoad() {
        await this.loadPlayerAssets();
    }

    /** 重新执行失败的主角资源加载。 */
    async retry() {
        await this.loadPlayerAssets();
    }

    /** 读取玩家数据，并把主角可达动作、头像、武器和技能加入共享缓存。 */
    private async loadPlayerAssets() {
        if (this.busy) return;
        this.busy = true;
        this.component.retryButton.node.active = false;
        this.setProgress(0, "读取主角数据");
        try {
            await new Promise<void>((resolve) => director.once(Director.EVENT_AFTER_DRAW, resolve));
            const { fighter } = await this.serve.getService(LocalPlayerGateway).getProfile();
            const config = new GameplayConfig();
            config.load(this.serve.configService.tables);
            const assets = getFighterAssets(config, [fighter]);
            const store = this.serve.getService(AssetStore);
            let completed = 0;
            this.setProgress(0.05, "加载主角资源");
            const results = await Promise.allSettled(assets.map(async ({ path, type }) => {
                await store.load(this.serve.assetService, path, type);
                this.setProgress(0.05 + (++completed / assets.length) * 0.95, "加载主角资源");
            }));
            const failed = results.find(result => result.status === "rejected") as PromiseRejectedResult | undefined;
            if (failed) throw failed.reason;
            this.setProgress(1, "准备进入大厅");
            await new Promise<void>((resolve) => director.once(Director.EVENT_AFTER_DRAW, resolve));
            await this.serve.viewService.load(ViewKeys.Lobby);
            this.serve.viewService.unload(ViewKeys.Preload);
        } catch (error) {
            console.error(error);
            this.component.message.string = "加载失败，请重试";
            this.component.retryButton.node.active = true;
        } finally {
            this.busy = false;
        }
    }

    /** 刷新进度条、百分比和提示文字。 */
    private setProgress(progress: number, message: string) {
        const value = Math.max(0, Math.min(1, progress));
        this.component.progress.fillRange = value;
        this.component.percent.string = Math.floor(value * 100) + "%";
        this.component.message.string = message;
    }
}
