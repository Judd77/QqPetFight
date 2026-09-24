import { _decorator, Button, Label, Node, Sprite } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { MatchingView } from "./MatchingView";

const { ccclass } = _decorator;

/** 匹配页的节点仓库和按钮事件转发。 */
@ccclass("MatchingComponent")
export class MatchingComponent extends BaseViewComponent<MatchingView> {
    declare playerPortrait: Sprite;
    declare opponentPortrait: Sprite;
    declare playerName: Label;
    declare opponentName: Label;
    declare status: Label;
    declare elapsed: Label;
    declare searching: Node;
    declare cancel: Button;
    declare retry: Button;

    protected override onLoad() {
        const panel = this.node.getChildByName("Panel")!;
        this.playerPortrait = panel.getChildByName("PlayerPortrait")!.getComponent(Sprite)!;
        this.opponentPortrait = panel.getChildByName("OpponentPortrait")!.getComponent(Sprite)!;
        this.playerName = panel.getChildByName("PlayerName")!.getComponent(Label)!;
        this.opponentName = panel.getChildByName("OpponentName")!.getComponent(Label)!;
        this.status = panel.getChildByName("Status")!.getComponent(Label)!;
        this.elapsed = panel.getChildByName("Elapsed")!.getComponent(Label)!;
        this.searching = panel.getChildByName("Searching")!;
        this.cancel = panel.getChildByName("Cancel")!.getComponent(Button)!;
        this.retry = panel.getChildByName("Retry")!.getComponent(Button)!;
        this.cancel.node.on(Button.EventType.CLICK, () => this.view.cancel());
        this.retry.node.on(Button.EventType.CLICK, () => void this.view.start());
    }
}
