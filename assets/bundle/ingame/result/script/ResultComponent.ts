import { _decorator, Button, Label, Node } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { ResultView } from "./ResultView";

const { ccclass } = _decorator;

/** 结算节点仓库，只获取组件并转发按钮事件。 */
@ccclass("ResultComponent")
export class ResultComponent extends BaseViewComponent<ResultView> {
    declare victory: Node;
    declare defeat: Node;
    declare summary: Label;
    declare saveButton: Button;
    declare againButton: Button;
    declare closeButton: Button;
    declare againLabel: Label;

    /** 动态获取预制体内的固定节点。 */
    protected override onLoad() {
        this.victory = this.node.getChildByName("Victory")!;
        this.defeat = this.node.getChildByName("Defeat")!;
        this.summary = this.node.getChildByName("Summary")!.getComponent(Label)!;
        this.saveButton = this.node.getChildByName("SaveRecording")!.getComponent(Button)!;
        this.againButton = this.node.getChildByName("Again")!.getComponent(Button)!;
        this.againLabel = this.againButton.node.getChildByName("Label")!.getComponent(Label)!;
        this.closeButton = this.node.getChildByName("Close")!.getComponent(Button)!;
        this.saveButton.node.on(Button.EventType.CLICK, () => this.view.onClickSave());
        this.againButton.node.on(Button.EventType.CLICK, () => this.view.onClickAgain());
        this.closeButton.node.on(Button.EventType.CLICK, () => this.view.onClickClose());
    }
}
