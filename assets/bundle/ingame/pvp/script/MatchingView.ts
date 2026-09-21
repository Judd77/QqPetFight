import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { MatchingComponent } from "./MatchingComponent";
import { MatchingController } from "./MatchingController";

/** PVP 匹配总入口，不在加载阶段等待整个匹配流程。 */
export class MatchingView extends BaseView<MatchingComponent> {
    readonly matchCtrl = new MatchingController(this);
    protected override readonly controllers = [this.matchCtrl];

    protected override async onLoad() {
        await this.matchCtrl.start();
    }
}
