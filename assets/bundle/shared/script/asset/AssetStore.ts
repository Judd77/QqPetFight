import { Asset, Constructor } from "cc";
import type { AssetService } from "db://assets/bootstrap/script/service/AssetService";

/** 跨业务共享成功加载的资源，失败可重试，并发加载只执行一次。 */
export class AssetStore {
    private readonly assets = new Map<string, Asset>();
    private readonly loading = new Map<string, Promise<Asset>>();

    async load<T extends Asset>(service: AssetService, path: string, type: Constructor<T>): Promise<T> {
        const cached = this.assets.get(path);
        if (cached) return cached as T;
        let task = this.loading.get(path);
        if (!task) {
            task = service.load(path, type).then(asset => {
                asset.addRef();
                this.assets.set(path, asset);
                return asset;
            });
            this.loading.set(path, task);
        }
        try {
            return await task as T;
        } finally {
            if (this.loading.get(path) === task) this.loading.delete(path);
        }
    }

    get<T extends Asset>(path: string): T {
        const asset = this.assets.get(path);
        if (!asset) throw new Error("资源尚未加载：" + path);
        return asset as T;
    }
}
