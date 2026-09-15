import { Node } from "cc";
import { AssetService } from "./AssetService";
import { AudioService } from "./AudioService";
import { ConfigService } from "./ConfigService";
import { ViewRegistry } from "./viewService/ViewRegistry";
import { ViewService } from "./viewService/ViewService";

/** 基础服务组合入口，具体业务服务可以在项目层另行组合。 */
export class ServiceLocator {
    declare readonly configService: ConfigService;
    declare readonly assetService: AssetService;
    declare readonly audioService: AudioService;
    declare readonly viewRegistry: ViewRegistry;
    declare readonly viewService: ViewService;

    constructor(facadeNode: Node) {
        this.assetService = new AssetService();
        this.viewRegistry = new ViewRegistry();
        this.configService = new ConfigService(this.assetService);
        this.audioService = new AudioService(this.assetService, facadeNode);
        this.viewService = new ViewService(this, this.viewRegistry, facadeNode);
    }

    update(dt: number) {
        this.viewService.update(dt);
    }
}
