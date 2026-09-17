import { Director, director } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LoadingView } from "./LoadingView";

/** 显示真实加载进度，完成后关闭，失败时允许重试或返回。 */
export class LoadingController extends BaseController<LoadingView> {
    private busy = false;

    /** 先让遮罩绘制一帧，再开始切场景和资源准备。 */
    async run() {
        if (this.busy) return;
        this.busy = true;
        const state = this.view.component;
        state.retryButton.node.active = false;
        state.backButton.node.active = false;
        this.setProgress(0, "加载战斗场景");
        try {
            await new Promise<void>((resolve) => director.once(Director.EVENT_AFTER_DRAW, resolve));
            await this.view.serve.viewService.loadWithComponentReady(ViewKeys.Gameplay,
                () => this.setProgress(0.2, "准备战斗资源"),
                (progress, message) => this.setProgress(progress, message));
            this.setProgress(1, "准备就绪");
            await new Promise<void>((resolve) => director.once(Director.EVENT_AFTER_DRAW, resolve));
            this.view.serve.viewService.unload(ViewKeys.Loading);
        } catch (error) {
            console.error(error);
            state.message.string = "加载失败，请重试或返回大厅";
            state.retryButton.node.active = true;
            state.backButton.node.active = true;
        } finally {
            this.busy = false;
        }
    }

    /** 按已完成的任务进度刷新进度条和百分比。 */
    setProgress(progress: number, message?: string) {
        const state = this.view.component;
        const value = Math.max(0, Math.min(1, progress));
        state.progress.fillRange = value;
        state.percent.string = Math.floor(value * 100) + "%";
        if (message) state.message.string = message;
    }

    /** 重试同一次场景加载流程，忽略重复点击。 */
    async onClickRetry() {
        await this.run();
    }

    /** 返回成功后才关闭遮罩，失败时保留操作入口。 */
    async onClickBack() {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.view.serve.viewService.load(ViewKeys.Lobby);
            this.view.serve.viewService.unload(ViewKeys.Loading);
        } catch (error) {
            console.error(error);
            this.view.component.message.string = "返回大厅失败，请重试";
        } finally {
            this.busy = false;
        }
    }

}
