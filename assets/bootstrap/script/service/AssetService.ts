import { Asset, AssetManager, assetManager, Constructor, director, ImageAsset, SceneAsset, SpriteFrame, Texture2D } from "cc";

const BUNDLE_NAME = "bundle";

/** 负责业务 Bundle 和远程资源的加载与释放。 */
export class AssetService {
    private bundleTask?: Promise<AssetManager.Bundle>;

    async loadBundle(): Promise<AssetManager.Bundle> {
        const loaded = assetManager.getBundle(BUNDLE_NAME);
        if (loaded) return loaded;

        if (this.bundleTask) return this.bundleTask;

        const task = new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(BUNDLE_NAME, (error, bundle) => {
                if (error) {
                    reject(new Error(`加载资源包【${BUNDLE_NAME}】失败：${error.message}`));
                    return;
                }
                resolve(bundle);
            });
        });
        this.bundleTask = task;
        try {
            return await task;
        } finally {
            if (this.bundleTask === task) this.bundleTask = undefined;
        }
    }

    async load<T extends Asset>(path: string, type: Constructor<T>): Promise<T> {
        const bundle = await this.loadBundle();
        return new Promise<T>((resolve, reject) => {
            bundle.load(path, type, (error, asset) => {
                if (error) {
                    reject(new Error(`加载资源【${path}】失败：${error.message}`));
                    return;
                }
                resolve(asset);
            });
        });
    }

    async loadDir<T extends Asset>(path: string, type: Constructor<T>): Promise<T[]> {
        const bundle = await this.loadBundle();
        return new Promise<T[]>((resolve, reject) => {
            bundle.loadDir(path, type, (error, assets) => {
                if (error) {
                    reject(new Error(`加载资源目录【${path}】失败：${error.message}`));
                    return;
                }
                resolve(assets);
            });
        });
    }

    async loadScene(path: string): Promise<void> {
        const bundle = await this.loadBundle();
        await new Promise<void>((resolve, reject) => {
            bundle.loadScene(path, (error, scene: SceneAsset) => {
                if (error) {
                    reject(new Error(`加载场景【${path}】失败：${error.message}`));
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

    removeBundle() {
        const bundle = assetManager.getBundle(BUNDLE_NAME);
        if (bundle) assetManager.removeBundle(bundle);
    }
}
