import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LobbyComponent } from "./LobbyComponent";

/** 大厅业务入口，直接处理模式入口跳转。 */
export class LobbyView extends BaseView<LobbyComponent> {
    private entering = false;

    protected override onLoad() {}

    /** 打开 PVE 对手选择。 */
    async openPve() {
        await this.open(ViewKeys.Pve);
    }

    /** 打开 PVP 匹配。 */
    async openPvp() {
        await this.open(ViewKeys.Matching);
    }

    /** 防止重复点击同时打开多个弹窗。 */
    private async open(key: typeof ViewKeys.Pve | typeof ViewKeys.Matching) {
        if (this.entering) return;
        this.entering = true;
        try {
            await this.serve.viewService.load(key);
        } catch (error) {
            console.error(error);
        } finally {
            this.entering = false;
        }
    }
}
