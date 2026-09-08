import { _decorator, Component, director } from "cc";
import { ServiceLocator } from "./service/ServiceLocator";

const { ccclass } = _decorator;

/** 单机 Demo 的启动入口和永久服务节点。 */
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
