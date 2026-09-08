import { Asset, AssetManager, assetManager, Constructor, director, ImageAsset, SceneAsset, SpriteFrame, Texture2D } from "cc";

/** 与具体 Bundle 名称和目录约定无关的资源服务。 */
export class AssetService {
    private readonly bundleTasks = new Map<string, Promise<AssetManager.Bundle>>();

    async loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        const loaded = assetManager.getBundle(bundleName);
        if (loaded) return loaded;

        const loading = this.bundleTasks.get(bundleName);
        if (loading) return loading;

        const task = new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(bundleName, (error, bundle) => {
                if (error) {
                    reject(new Error(`加载资源包【${bundleName}】失败：${error.message}`));
                    return;
                }
                resolve(bundle);
            });
        });
        this.bundleTasks.set(bundleName, task);
        try {
            return await task;
        } finally {
            if (this.bundleTasks.get(bundleName) === task) this.bundleTasks.delete(bundleName);
        }
    }

    async load<T extends Asset>(bundleName: string, path: string, type: Constructor<T>): Promise<T> {
        const bundle = await this.loadBundle(bundleName);
        return new Promise<T>((resolve, reject) => {
            bundle.load(path, type, (error, asset) => {
                if (error) {
                    reject(new Error(`加载资源【${bundleName}/${path}】失败：${error.message}`));
                    return;
                }
                resolve(asset);
            });
        });
    }

    async loadDir<T extends Asset>(bundleName: string, path: string, type: Constructor<T>): Promise<T[]> {
        const bundle = await this.loadBundle(bundleName);
        return new Promise<T[]>((resolve, reject) => {
            bundle.loadDir(path, type, (error, assets) => {
                if (error) {
                    reject(new Error(`加载资源目录【${bundleName}/${path}】失败：${error.message}`));
                    return;
                }
                resolve(assets);
            });
        });
    }

    async loadScene(bundleName: string, path: string): Promise<void> {
        const bundle = await this.loadBundle(bundleName);
        await new Promise<void>((resolve, reject) => {
            bundle.loadScene(path, (error, scene: SceneAsset) => {
                if (error) {
                    reject(new Error(`加载场景【${bundleName}/${path}】失败：${error.message}`));
                    return;
                }
                director.runScene(scene, undefined, () => resolve());
            });
        });
    }

    async loadRemoteSpriteFrame(url: string): Promise<SpriteFrame> {
        const path = url.split("?")[0] ?? url;
        return new Promise<SpriteFrame>((resolve, reject) => {
            assetManager.loadRemote<ImageAsset>(url, { ext: ".png" }, (error, image) => {
                if (error) {
                    reject(new Error(`加载远程图片【${path}】失败：${error.message}`));
                    return;
                }
                const texture = new Texture2D();
                texture.image = image;
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                resolve(spriteFrame);
            });
        });
    }

    release(asset: Asset) {
        assetManager.releaseAsset(asset);
    }

    removeBundle(bundleName: string) {
        const bundle = assetManager.getBundle(bundleName);
        if (bundle) assetManager.removeBundle(bundle);
    }
}
