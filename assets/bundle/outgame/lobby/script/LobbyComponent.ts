import { _decorator, Button, find } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { LobbyView } from "./LobbyView";

const { ccclass } = _decorator;

@ccclass("LobbyComponent")
export class LobbyComponent extends BaseViewComponent<LobbyView> {
    protected override onLoad() {
        find("Canvas/Button Fight")!.on(Button.EventType.CLICK, () => this.view.onFightButtonClick(), this);
    }
}
