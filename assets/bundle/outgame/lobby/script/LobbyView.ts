import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { LobbyComponent } from "./LobbyComponent";

export class LobbyView extends BaseView<LobbyComponent> {
    protected onLoad(): void | Promise<void> {}
}
