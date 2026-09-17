import { AssetService } from "./AssetService";

/** 由业务层补充具体表类型，启动包不依赖业务生成脚本。 */
export interface ConfigTables {}

/** 统一加载并持有 Luban 配置表。 */
export class ConfigService {
    /** 业务 Bundle 加载时提供 Tables 的创建方法。 */
    static createTables?: (loader: (fileName: string) => unknown) => ConfigTables;
    private loadingPromise?: Promise<void>;
    private table?: ConfigTables;

    constructor(private readonly assets: AssetService) {}

    /** 获取启动阶段已经加载好的配置表。 */
    get tables(): ConfigTables {
        if (!this.table) throw new Error("配置表尚未加载");
        return this.table;
    }

    /** 加载公共配置表。 */
    async loadConfig(sharedPath: string) {
        if (this.table) return;
        if (this.loadingPromise) return this.loadingPromise;

        const task = this.loadTable(sharedPath);
        this.loadingPromise = task;
        try {
            await task;
        } finally {
            if (this.loadingPromise === task) this.loadingPromise = undefined;
        }
    }

    /** 将 JsonAsset 映射交给 Luban Tables 构造函数解析。 */
    private async loadTable(sharedPath: string) {
        const createTables = ConfigService.createTables;
        if (!createTables) throw new Error("业务配置表尚未注册");
        const assets = await this.assets.loadJsonAssets(sharedPath);
        if (!assets.length) throw new Error(`配置目录【${sharedPath}/config】为空`);

        const configs = new Map<string, unknown>();
        for (const asset of assets) {
            if (configs.has(asset.name)) throw new Error(`配置文件名称重复【${asset.name}】`);
            if (asset.json == null) throw new Error(`配置文件【${asset.name}】内容为空`);
            configs.set(asset.name, asset.json);
        }

        const loader = (fileName: string) => {
            if (!configs.has(fileName)) throw new Error(`缺少配置文件【${fileName}】`);
            return configs.get(fileName);
        };
        this.table = createTables(loader);
    }
}
