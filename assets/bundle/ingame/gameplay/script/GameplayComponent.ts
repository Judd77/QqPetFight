import { _decorator, Button, find, Label, Node, Sprite, SpriteFrame } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { GameplayView } from "./GameplayView";
import type { WeaponId } from "./battle/BattleTypes";

const { ccclass } = _decorator;

interface PlayerUi {
    portrait: Sprite;
    hp: Sprite;
    health: Label;
    name: Label;
    weapons: Node;
    skills: Node;
}

/** 场景引用与运行状态仓库。 */
@ccclass("GameplayComponent")
export class GameplayComponent extends BaseViewComponent<GameplayView> {
    declare worldRoot: Node;
    declare uiRoot: Node;
    readonly players: PlayerUi[] = [];
    declare roundLabel: Label;
    declare actionLabel: Label;
    declare speedButton: Node;
    actionExpires = 0;

    declare weaponFrames: Map<WeaponId, SpriteFrame>;

    /** 一次性获取场景固定布局，武器与技能列表交给各自 Controller 填入。 */
    protected override onLoad() {
        this.worldRoot = find("2d")!;
        this.uiRoot = find("Ui")!;
        if (!this.worldRoot || !this.uiRoot) throw new Error("Gameplay 缺少 2d 或 Ui 节点");
        for (const name of ["Left", "Right"]) {
            const panel = this.uiRoot.getChildByName(name)!;
            this.players.push({
                portrait: panel.getChildByName("Portrait")!.getComponent(Sprite)!,
                hp: panel.getChildByName("Hp")!.getComponent(Sprite)!,
                health: panel.getChildByName("HpText")!.getComponent(Label)!,
                name: panel.getChildByName("Name")!.getComponent(Label)!,
                weapons: panel.getChildByName("Weapons")!,
                skills: panel.getChildByName("Skills")!,
            });
        }
        this.roundLabel = this.uiRoot.getChildByName("Round")!.getComponent(Label)!;
        this.actionLabel = this.uiRoot.getChildByName("Action")!.getComponent(Label)!;
        this.speedButton = this.uiRoot.getChildByName("Speed")!;
        this.speedButton.on(Button.EventType.CLICK, () => this.view.uiCtrl.onClickSpeed());
    }
}
