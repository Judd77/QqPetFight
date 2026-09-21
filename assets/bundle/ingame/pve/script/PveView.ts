import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { PveComponent } from "./PveComponent";
import { PveController } from "./PveController";

/** PVE 对手预览总入口。 */
export class PveView extends BaseView<PveComponent> {
    readonly pveCtrl = new PveController(this);
    protected override readonly controllers = [this.pveCtrl];
    protected override async onLoad() {
        await this.pveCtrl.show();
    }
}
