import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { ResultView } from "./ResultView";

/** 结算显示、录像收藏和导航；不参与战斗逻辑。 */
export class ResultController extends BaseController<ResultView> {
    private busy = false;
    private saved = false;

    /** 每次打开使用本局数据，胜负音效只播放一次。 */
    show() {
        const { winner, saved } = this.view.params;
        const state = this.view.component;
        this.busy = false;
        this.saved = saved;
        state.victory.active = winner === 0;
        state.defeat.active = winner !== 0;
        state.summary.string = winner === 0 ? "乐斗胜利！" : winner === -1 ? "平局" : "再接再厉";
        this.refreshButtons();
        if (winner >= 0) this.view.serve.audioService.playSound(winner === 0 ? "Win" : "Lose");
    }

    /** 收藏完整录像，失败时保留重试入口。 */
    onClickSave() {
        if (this.busy || this.saved) return;
        try {
            this.view.params.saveRecording();
            this.saved = true;
            this.view.component.summary.string = "录像已收藏到本机";
            this.refreshButtons();
        } catch (error) {
            console.error(error);
            this.view.component.summary.string = "收藏失败，请检查本机存储";
        }
    }

    /** 新局准备成功后关闭结算，失败时留在结算重试。 */
    async onClickAgain() {
        if (this.busy) return;
        this.busy = true;
        this.refreshButtons();
        try {
            await this.view.params.playAgain();
            this.view.serve.viewService.unload(ViewKeys.Result);
        } catch (error) {
            console.error(error);
            if (this.view.isLoaded) this.view.component.summary.string = "战斗加载失败，请重试";
        } finally {
            this.busy = false;
            if (this.view.isLoaded) this.refreshButtons();
        }
    }

    /** 返回大厅；Gameplay 卸载时会同时清理结算。 */
    async onClickClose() {
        if (this.busy) return;
        this.busy = true;
        this.refreshButtons();
        try {
            await this.view.serve.viewService.load(ViewKeys.Lobby);
        } catch (error) {
            console.error(error);
            if (this.view.isLoaded) this.view.component.summary.string = "返回大厅失败，请重试";
        } finally {
            this.busy = false;
            if (this.view.isLoaded) this.refreshButtons();
        }
    }

    /** 请求过程中禁用按钮，防止重复开局或切换场景。 */
    private refreshButtons() {
        const state = this.view.component;
        state.saveButton.interactable = !this.busy && !this.saved;
        state.againButton.interactable = !this.busy;
        state.closeButton.interactable = !this.busy;
    }
}
