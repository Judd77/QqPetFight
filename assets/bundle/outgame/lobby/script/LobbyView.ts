import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LobbyComponent } from "./LobbyComponent";

export class LobbyView extends BaseView<LobbyComponent> {
    private entering = false;

    protected override onLoad() {}

    /** 先显示临时加载页，再进入玩法；完成后加载页销毁。 */
    async onFightButtonClick() {
        if (this.entering) return;
        this.entering = true;
        try {
            await this.serve.viewService.load(ViewKeys.Loading);
        } finally {
            this.entering = false;
        }
    }
}
