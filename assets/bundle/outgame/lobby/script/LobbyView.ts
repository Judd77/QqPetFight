import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { LobbyComponent } from "./LobbyComponent";
import { LobbyController } from "./LobbyController";

export class LobbyView extends BaseView<LobbyComponent> {
    readonly lobbyCtrl = new LobbyController(this);
    protected override readonly controllers = [this.lobbyCtrl];

    protected override onLoad() {}

}
