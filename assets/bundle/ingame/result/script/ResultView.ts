import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ResultController } from "./ResultController";
import type { ResultComponent } from "./ResultComponent";

export interface ResultParams {
    winner: number;
    summary: string;
    actionText: string;
    saved: boolean;
    saveRecording: () => void;
    playAgain: () => Promise<void>;
}

/** 独立结算入口，战斗与录像操作通过参数交回玩法。 */
export class ResultView extends BaseView<ResultComponent, [ResultParams]> {
    declare params: ResultParams;
    readonly resultCtrl = new ResultController(this);
    protected override readonly controllers = [this.resultCtrl];

    /** 绑定本局结果并展示结算。 */
    protected override onLoad(params: ResultParams) {
        this.params = params;
        this.resultCtrl.show();
    }
}
