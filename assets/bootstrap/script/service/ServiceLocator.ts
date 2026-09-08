import { Node } from "cc";
import { AssetService } from "./AssetService";
import { AudioService } from "./AudioService";
import { ConfigService } from "./ConfigService";
import { ViewRegistry } from "./viewService/ViewRegistry";
import { ViewService } from "./viewService/ViewService";

/** 基础服务组合入口，具体业务服务可以在项目层另行组合。 */
export class ServiceLocator {
    readonly assetService = new AssetService();
    readonly configService = new ConfigService(this.assetService);
    readonly audioService = new AudioService(this.assetService);
    readonly viewRegistry = new ViewRegistry();
    readonly viewService: ViewService;

    constructor(facadeNode: Node) {
        this.audioService.build(facadeNode);
        this.viewService = new ViewService(this, this.viewRegistry);
        this.viewService.build(facadeNode);
    }

    update(dt: number) {
        this.viewService.update(dt);
    }

    destroy() {
        this.viewService.destroy();
        this.audioService.destroy();
        this.configService.clear();
        this.viewRegistry.clear();
    }
}
