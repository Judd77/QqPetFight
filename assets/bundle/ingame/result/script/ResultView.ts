import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import { GameplayMode } from "../../gameplay/script/common/GameplayEntry";
import type { GameplayEntry } from "../../gameplay/script/common/GameplayEntry";
import { PveCampaign } from "../../pve/script/PveCampaign";
import type { ResultComponent } from "./ResultComponent";

export interface ResultParams {
    entry: GameplayEntry;
    winner: number;
    replaying: boolean;
    saved: boolean;
    saveRecording: () => void;
}

/** 独立结算业务入口。 */
export class ResultView extends BaseView<ResultComponent, [ResultParams]> {
    declare params: ResultParams;
    private readonly campaign = new PveCampaign();
    private busy = false;
    private saved = false;

    /** 完成本局业务结算并展示胜负、文案和操作入口。 */
    protected override onLoad(params: ResultParams) {
        this.params = params;
        this.busy = false;
        this.saved = params.saved;

        const { summary, actionText } = this.createResultText();
        const component = this.component;
        component.victory.active = params.winner === 0;
        component.defeat.active = params.winner !== 0;
        component.summary.string = summary;
        component.againLabel.string = actionText;
        this.refreshButtons();

        if (params.winner >= 0) {
            this.serve.audioService.playSound(params.winner === 0 ? "Win" : "Lose");
        }
    }

    /** 收藏完整录像，失败时保留重试入口。 */
    onClickSave() {
        if (this.busy || this.saved) return;
        try {
            this.params.saveRecording();
            this.saved = true;
            this.component.summary.string = "录像已收藏到本机";
            this.refreshButtons();
        } catch (error) {
            console.error(error);
            this.component.summary.string = "收藏失败，请检查本机存储";
        }
    }

    /** 返回对应模式入口，准备下一场战斗。 */
    async onClickAgain() {
        if (this.busy) return;
        this.busy = true;
        this.refreshButtons();
        try {
            const target = this.params.entry.mode === GameplayMode.Pve ? ViewKeys.Pve : ViewKeys.Matching;
            await this.serve.viewService.load(ViewKeys.Lobby);
            await this.serve.viewService.load(target);
            this.serve.viewService.unload(ViewKeys.Result);
        } catch (error) {
            console.error(error);
            if (this.isLoaded) this.component.summary.string = "战斗加载失败，请重试";
        } finally {
            this.busy = false;
            if (this.isLoaded) this.refreshButtons();
        }
    }

    /** 关闭结算并返回大厅。 */
    async onClickClose() {
        if (this.busy) return;
        this.busy = true;
        this.refreshButtons();
        try {
            await this.serve.viewService.load(ViewKeys.Lobby);
        } catch (error) {
            console.error(error);
            if (this.isLoaded) this.component.summary.string = "返回大厅失败，请重试";
        } finally {
            this.busy = false;
            if (this.isLoaded) this.refreshButtons();
        }
    }

    /** 根据玩法入口完成 PVE 进度结算，并生成对应文案。 */
    private createResultText() {
        const { entry, replaying, winner } = this.params;
        if (entry.mode !== GameplayMode.Pve) {
            return {
                summary: winner === 0
                    ? "切磋获胜 · 好身手！"
                    : winner === 1 ? "切磋落败 · 再接再厉" : "本场平局 · 再战一场",
                actionText: "再次匹配",
            };
        }

        const tables = this.serve.configService.tables;
        if (!replaying) this.campaign.complete(entry.stageId, winner, tables);
        const clearedAll = this.campaign.getCleared() >= this.campaign.getStages(tables).length;
        return {
            summary: winner === 0
                ? (clearedAll ? "全部通关 · 江湖扬名！" : "第 " + entry.stageId + " 关通关 · 下一关已解锁")
                : "第 " + entry.stageId + " 关挑战失败 · 再接再厉",
            actionText: winner === 0 ? (clearedAll ? "返回关卡" : "下一关") : "再挑战",
        };
    }

    /** 请求进行中禁用按钮，防止重复收藏或重复跳转。 */
    private refreshButtons() {
        this.component.saveButton.interactable = !this.busy && !this.saved;
        this.component.againButton.interactable = !this.busy;
        this.component.closeButton.interactable = !this.busy;
    }
}
