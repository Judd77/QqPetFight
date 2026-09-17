import { _decorator, Component, director } from "cc";
import { ServiceLocator } from "./service/ServiceLocator";

const { ccclass } = _decorator;
/** 单机 Demo 的启动入口和永久服务节点。 */
@ccclass("Facade")
export class Facade extends Component {
    declare private services: ServiceLocator;

    protected override onLoad() {
        this.services = new ServiceLocator(this.node);
        director.addPersistRootNode(this.node);
        this.loadBusiness();
    }

    private async loadBusiness() {
        await this.services.assetService.loadBundle();
        const entryView = this.services.viewRegistry.registerSchema();
        await Promise.all([
            this.services.audioService.setAudioClips(this.services.viewRegistry.sharedPath),
            this.services.configService.loadConfig(this.services.viewRegistry.sharedPath),
            ...this.services.viewRegistry.preloadViews.map((view) => this.services.viewService.preload(view)),
        ]);
        await this.services.viewService.load(entryView);
    }

    protected override update(dt: number) {
        this.services.update(dt);
    }
}
