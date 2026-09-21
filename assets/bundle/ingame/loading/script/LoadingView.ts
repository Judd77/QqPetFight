import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { LoadingComponent } from "./LoadingComponent";
import { LoadingController } from "./LoadingController";
import type { BattleEntry } from "../../gameplay/script/battle/BattleEntry";

export type LoadingProgress = (progress: number, message?: string) => void;

/** 进入玩法时显示，加载完成后销毁的临时界面。 */
export class LoadingView extends BaseView<LoadingComponent, [BattleEntry]> {
    declare battle: BattleEntry;
    readonly loadingCtrl = new LoadingController(this);
    protected override readonly controllers = [this.loadingCtrl];

    /** 真正打开界面后才开始加载玩法。 */
    protected override async onLoad(battle: BattleEntry) {
        this.battle = battle;
        await this.loadingCtrl.run();
    }
}
