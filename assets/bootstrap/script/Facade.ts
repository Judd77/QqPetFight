import { _decorator, Component, director } from "cc";
import { ServiceLocator } from "./service/ServiceLocator";

const { ccclass } = _decorator;

/**
 * 框架启动入口。
 * 只负责创建和驱动基础服务，不加载任何具体业务界面。
 */
@ccclass("Facade")
export class Facade extends Component {
    private services?: ServiceLocator;

    protected override onLoad() {
        director.addPersistRootNode(this.node);
        this.services = new ServiceLocator(this.node);
    }

    protected override update(dt: number) {
        this.services?.update(dt);
    }

    protected override onDestroy() {
        this.services?.destroy();
        this.services = undefined;
    }
}
