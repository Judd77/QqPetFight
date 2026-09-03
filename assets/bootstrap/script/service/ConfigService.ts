import { JsonAsset } from "cc";
import { AssetService } from "./AssetService";

/** 通用 JSON 配置仓库，不依赖任何生成表类型。 */
export class ConfigService {
    private readonly groups = new Map<string, Map<string, unknown>>();
    private readonly loadingGroups = new Map<string, Promise<void>>();

    constructor(private readonly assets: AssetService) {}

    async loadGroup(group: string, bundleName: string, path: string) {
        if (this.groups.has(group)) return;
        const loading = this.loadingGroups.get(group);
        if (loading) return loading;

        const task = this.loadConfigGroup(group, bundleName, path);
        this.loadingGroups.set(group, task);
        try {
            await task;
        } finally {
            if (this.loadingGroups.get(group) === task) this.loadingGroups.delete(group);
        }
    }

    get<T>(name: string, group = "default"): T {
        const configs = this.groups.get(group);
        if (!configs?.has(name)) throw new Error(`配置【${group}/${name}】尚未加载`);
        return configs.get(name) as T;
    }

    has(name: string, group = "default"): boolean {
        return this.groups.get(group)?.has(name) ?? false;
    }

    unloadGroup(group: string) {
        this.groups.delete(group);
    }

    clear() {
        this.groups.clear();
        this.loadingGroups.clear();
    }

    private async loadConfigGroup(group: string, bundleName: string, path: string) {
        const assets = await this.assets.loadDir(bundleName, path, JsonAsset);
        const configs = new Map<string, unknown>();
        for (const asset of assets) {
            if (configs.has(asset.name)) throw new Error(`配置分组【${group}】存在重名文件【${asset.name}】`);
            if (asset.json == null) throw new Error(`配置【${group}/${asset.name}】内容为空`);
            configs.set(asset.name, asset.json);
        }
        this.groups.set(group, configs);
    }
}
