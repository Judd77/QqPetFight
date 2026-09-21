import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LobbyView } from "./LobbyView";

/** 大厅业务入口，防止重复点击同时打开多个弹窗。 */
export class LobbyController extends BaseController<LobbyView> {
    private entering = false;

    async openPve() {
        await this.open(ViewKeys.Pve);
    }

    async openPvp() {
        await this.open(ViewKeys.Matching);
    }

    private async open(key: typeof ViewKeys.Pve | typeof ViewKeys.Matching) {
        if (this.entering) return;
        this.entering = true;
        try {
            await this.view.serve.viewService.load(key);
        } catch (error) {
            console.error(error);
        } finally {
            this.entering = false;
        }
    }
}
