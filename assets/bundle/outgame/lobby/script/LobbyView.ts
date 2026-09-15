import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LobbyComponent } from "./LobbyComponent";

export class LobbyView extends BaseView<LobbyComponent> {
    protected onLoad() {}

    async onFightButtonClick() {
        await this.serve.viewService.load(ViewKeys.Gameplay);
    }
}
