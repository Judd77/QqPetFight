import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import { PveCampaign } from "../../../pve/script/PveCampaign";
import { BattleMode } from "../battle/BattleEntry";
import type { GameplayView } from "../GameplayView";

/** 根据进场来源处理结算与返回入口，PVP 不读写闯关进度。 */
export class BattleResultController extends BaseController<GameplayView> {
    private readonly campaign = new PveCampaign();

    async show() {
        const session = this.view.context.session;
        if (!session?.finished) return;
        const entry = this.view.entry;
        const winner = session.state.winner;
        let summary = winner === 0 ? "切磋获胜 · 好身手！" : winner === 1 ? "切磋落败 · 再接再厉" : "本场平局 · 再战一场";
        let actionText = "再次匹配";
        if (entry.mode === BattleMode.Pve) {
            const tables = this.view.serve.configService.tables;
            if (!this.view.context.replaying) this.campaign.complete(entry.stageId, winner, tables);
            const clearedAll = this.campaign.getCleared() >= this.campaign.getStages(tables).length;
            summary = winner === 0
                ? (clearedAll ? "全部通关 · 江湖扬名！" : "第 " + entry.stageId + " 关通关 · 下一关已解锁")
                : "第 " + entry.stageId + " 关挑战失败 · 再接再厉";
            actionText = winner === 0 ? (clearedAll ? "返回关卡" : "下一关") : "再挑战";
        }
        await this.view.serve.viewService.load(ViewKeys.Result, {
            winner,
            summary,
            actionText,
            saved: this.view.recordingCtrl.isCurrentSaved,
            saveRecording: () => this.view.recordingCtrl.save(),
            playAgain: () => this.playAgain(),
        });
    }

    private async playAgain() {
        const target = this.view.entry.mode === BattleMode.Pve ? ViewKeys.Pve : ViewKeys.Matching;
        const service = this.view.serve.viewService;
        await service.load(ViewKeys.Lobby);
        await service.load(target);
    }
}
