import { _decorator, Button, Label, Sprite } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { PreloadView } from "./PreloadView";

const { ccclass } = _decorator;

/** 启动预加载界面的节点引用和重试事件转发。 */
@ccclass("PreloadComponent")
export class PreloadComponent extends BaseViewComponent<PreloadView> {
    declare progress: Sprite;
    declare percent: Label;
    declare message: Label;
    declare retryButton: Button;

    protected override onLoad() {
        this.progress = this.node.getChildByPath("Progress/Sprite")!.getComponent(Sprite)!;
        this.percent = this.node.getChildByPath("Progress/Label")!.getComponent(Label)!;
        this.message = this.node.getChildByName("Message")!.getComponent(Label)!;
        this.retryButton = this.node.getChildByName("Retry")!.getComponent(Button)!;
        this.retryButton.node.on(Button.EventType.CLICK, () => void this.view.retry());
    }
}
