import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { LoadingComponent } from "./LoadingComponent";
import { LoadingController } from "./LoadingController";

export type LoadingProgress = (progress: number, message?: string) => void;

/** 进入玩法时显示，加载完成后销毁的临时界面。 */
export class LoadingView extends BaseView<LoadingComponent> {
    readonly loadingCtrl = new LoadingController(this);
    protected override readonly controllers = [this.loadingCtrl];

    /** 真正打开界面后才开始加载玩法。 */
    protected override async onLoad() {
        await this.loadingCtrl.run();
    }
}
