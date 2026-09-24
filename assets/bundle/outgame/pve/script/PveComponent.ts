import { _decorator, Button, Label, Node, Sprite } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { PveView } from "./PveView";
const { ccclass } = _decorator;

/** 固定节点引用和按钮事件转发。 */
@ccclass("PveComponent")
export class PveComponent extends BaseViewComponent<PveView> {
    declare title: Label;
    declare progress: Label;
    declare nameLabel: Label;
    declare health: Label;
    declare description: Label;
    declare message: Label;
    declare portrait: Sprite;
    declare weapons: Node;
    declare skills: Node;
    declare challenge: Button;
    declare challengeLabel: Label;
    declare close: Button;

    protected override onLoad() {
        const panel = this.node.getChildByName("Panel")!;
        this.title = panel.getChildByName("Title")!.getComponent(Label)!;
        this.progress = panel.getChildByName("Progress")!.getComponent(Label)!;
        this.nameLabel = panel.getChildByName("Name")!.getComponent(Label)!;
        this.health = panel.getChildByName("Health")!.getComponent(Label)!;
        this.description = panel.getChildByName("Description")!.getComponent(Label)!;
        this.message = panel.getChildByName("Message")!.getComponent(Label)!;
        this.portrait = panel.getChildByName("Portrait")!.getComponent(Sprite)!;
        this.weapons = panel.getChildByName("Weapons")!;
        this.skills = panel.getChildByName("Skills")!;
        this.challenge = panel.getChildByName("Challenge")!.getComponent(Button)!;
        this.challengeLabel = this.challenge.node.getChildByName("Label")!.getComponent(Label)!;
        this.close = panel.getChildByName("Close")!.getComponent(Button)!;
        this.challenge.node.on(Button.EventType.CLICK, () => void this.view.challenge());
        this.close.node.on(Button.EventType.CLICK, () => this.view.close());
    }
}
