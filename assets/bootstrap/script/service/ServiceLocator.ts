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
    private readonly businessServices = new Map<Function, unknown>();

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

    /** 按业务类型创建并复用服务实例，不让启动包依赖具体业务脚本。 */
    getService<T>(type: new () => T): T {
        const existing = this.businessServices.get(type);
        if (existing) return existing as T;
        const service = new type();
        this.businessServices.set(type, service);
        return service;
    }
}
