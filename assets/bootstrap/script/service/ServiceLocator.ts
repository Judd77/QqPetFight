import { Node } from "cc";
import { AssetService } from "./AssetService";
import { AudioService } from "./AudioService";
import { ConfigService } from "./ConfigService";
import { NetService } from "./netService/NetService";
import { ViewRegistry } from "./viewService/ViewRegistry";
import { ViewService } from "./viewService/ViewService";

/** 基础服务组合入口，具体业务服务可以在项目层另行组合。 */
export class ServiceLocator {
    private static current?: ServiceLocator;

    static get instance(): ServiceLocator {
        if (!this.current) throw new Error("ServiceLocator 尚未初始化");
        return this.current;
    }

    static get initialized(): boolean {
        return !!this.current;
    }

    readonly assetService = new AssetService();
    readonly configService = new ConfigService(this.assetService);
    readonly audioService = new AudioService(this.assetService);
    readonly netService = new NetService();
    readonly viewRegistry = new ViewRegistry();
    readonly viewService: ViewService;

    constructor(facadeNode: Node) {
        if (ServiceLocator.current) throw new Error("ServiceLocator 不能重复初始化");
        ServiceLocator.current = this;

        this.audioService.build(facadeNode);
        this.viewService = new ViewService(this, this.viewRegistry);
        this.viewService.build(facadeNode);
    }

    update(dt: number) {
        this.viewService.update(dt);
    }

    destroy() {
        this.viewService.destroy();
        this.netService.destroy();
        this.audioService.destroy();
        this.configService.clear();
        this.viewRegistry.clear();
        if (ServiceLocator.current === this) ServiceLocator.current = undefined;
    }
}
