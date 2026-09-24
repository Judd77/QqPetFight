import { _decorator, Button, Label, Sprite } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { LoadingView } from "./LoadingView";

const { ccclass } = _decorator;

/** 加载界面的节点仓库与按钮事件转发。 */
@ccclass("LoadingComponent")
export class LoadingComponent extends BaseViewComponent<LoadingView> {
    declare progress: Sprite;
    declare percent: Label;
    declare message: Label;
    declare retryButton: Button;
    declare backButton: Button;

    /** 动态获取预制体内的固定节点。 */
    protected override onLoad() {
        this.progress = this.node.getChildByPath("Progress/Sprite")!.getComponent(Sprite)!;
        this.percent = this.node.getChildByPath("Progress/Label")!.getComponent(Label)!;
        this.message = this.node.getChildByName("Message")!.getComponent(Label)!;
        this.retryButton = this.node.getChildByName("Retry")!.getComponent(Button)!;
        this.backButton = this.node.getChildByName("Back")!.getComponent(Button)!;
        this.retryButton.node.on(Button.EventType.CLICK, () => this.view.onClickRetry());
        this.backButton.node.on(Button.EventType.CLICK, () => this.view.onClickBack());
    }
}
