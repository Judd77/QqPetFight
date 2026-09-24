import { Director, director } from "cc";
import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LoadingComponent } from "./LoadingComponent";
import type { GameplayEntry } from "../../gameplay/script/model/GameplayEntry";

export type LoadingProgress = (progress: number, message?: string) => void;

/** 进入玩法时显示，加载完成后销毁的临时界面。 */
export class LoadingView extends BaseView<LoadingComponent, [GameplayEntry]> {
    declare battle: GameplayEntry;
    private busy = false;

    /** 真正打开界面后才开始加载玩法。 */
    protected override async onLoad(battle: GameplayEntry) {
        this.battle = battle;
        await this.run();
    }

    /** 先让遮罩绘制一帧，再开始切场景和资源准备。 */
    private async run() {
        if (this.busy) return;
        this.busy = true;
        const component = this.component;
        component.retryButton.node.active = false;
        component.backButton.node.active = false;
        this.setProgress(0, "加载战斗场景");
        try {
            await new Promise<void>((resolve) => director.once(Director.EVENT_AFTER_DRAW, resolve));
            await this.serve.viewService.loadWithComponentReady(ViewKeys.Gameplay,
                () => this.setProgress(0.2, "准备战斗资源"),
                this.battle,
                (progress, message) => this.setProgress(progress, message));
            this.setProgress(1, "准备就绪");
            await new Promise<void>((resolve) => director.once(Director.EVENT_AFTER_DRAW, resolve));
            this.serve.viewService.unload(ViewKeys.Loading);
            this.serve.viewService.unload(ViewKeys.Pve);
        } catch (error) {
            console.error(error);
            component.message.string = "加载失败，请重试或返回大厅";
            component.retryButton.node.active = true;
            component.backButton.node.active = true;
        } finally {
            this.busy = false;
        }
    }

    /** 重试同一次场景加载流程。 */
    async onClickRetry() {
        await this.run();
    }

    /** 返回成功后关闭加载页和 PVE 对手页。 */
    async onClickBack() {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.serve.viewService.load(ViewKeys.Lobby);
            this.serve.viewService.unload(ViewKeys.Pve);
            this.serve.viewService.unload(ViewKeys.Loading);
        } catch (error) {
            console.error(error);
            this.component.message.string = "返回大厅失败，请重试";
        } finally {
            this.busy = false;
        }
    }

    /** 刷新进度条、百分比和提示文字。 */
    private setProgress(progress: number, message?: string) {
        const value = Math.max(0, Math.min(1, progress));
        this.component.progress.fillRange = value;
        this.component.percent.string = Math.floor(value * 100) + "%";
        if (message) this.component.message.string = message;
    }
}
