import { _decorator, Button, find, Label, Node, Sprite } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { GameplayView } from "./GameplayView";

const { ccclass } = _decorator;

export interface PlayerUi {
    portrait: Sprite;
    hp: Sprite;
    health: Label;
    name: Label;
    weapons: Node;
    skills: Node;
}

/** 只保存 Cocos 引用并转发按钮事件，不保存任何业务运行状态。 */
@ccclass("GameplayComponent")
export class GameplayComponent extends BaseViewComponent<GameplayView> {
    declare worldRoot: Node;
    declare uiRoot: Node;
    readonly players: PlayerUi[] = [];
    readonly actors: Node[] = [];
    readonly actorSprites: Sprite[] = [];
    readonly groundWeapons: Sprite[] = [];
    readonly damageLabels: Label[] = [];
    declare projectile: Sprite;
    declare roundLabel: Label;
    declare actionLabel: Label;
    declare speedButton: Node;

    protected override onLoad() {
        this.worldRoot = find("2d")!;
        this.uiRoot = find("Ui")!;
        if (!this.worldRoot || !this.uiRoot) throw new Error("Gameplay 缺少 2d 或 Ui 节点");

        const fighters = this.worldRoot.getChildByName("Fighters")!;
        for (const name of ["Left", "Right"]) {
            const panel = this.uiRoot.getChildByName(name)!;
            const actor = fighters.getChildByName(name)!;
            this.players.push({
                portrait: panel.getChildByName("Portrait")!.getComponent(Sprite)!,
                hp: panel.getChildByName("Hp")!.getComponent(Sprite)!,
                health: panel.getChildByName("HpText")!.getComponent(Label)!,
                name: panel.getChildByName("Name")!.getComponent(Label)!,
                weapons: panel.getChildByName("Weapons")!,
                skills: panel.getChildByName("Skills")!,
            });
            this.actors.push(actor);
            this.actorSprites.push(actor.getChildByName("Actor")!.getComponent(Sprite)!);
            this.groundWeapons.push(fighters.getChildByName("GroundWeapon" + this.actors.length)!.getComponent(Sprite)!);
        }
        for (let index = 0; index < 2; index++) {
            this.damageLabels.push(fighters.getChildByName("Damage" + index)!.getComponent(Label)!);
        }
        this.projectile = fighters.getChildByName("Projectile")!.getComponent(Sprite)!;
        this.roundLabel = this.uiRoot.getChildByName("Round")!.getComponent(Label)!;
        this.actionLabel = this.uiRoot.getChildByName("Action")!.getComponent(Label)!;
        this.speedButton = this.uiRoot.getChildByName("Speed")!;
        this.speedButton.on(Button.EventType.CLICK, () => this.view.uiCtrl.onClickSpeed());
    }
}
