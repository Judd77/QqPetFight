import { director, error, find, instantiate, log, Node, Prefab, Widget } from "cc";
import type { ServiceLocator } from "../ServiceLocator";
import type { AnyView } from "./BaseView";
import { BaseViewComponent } from "./BaseViewComponent";
import { ViewDefinition } from "./ViewDefinition";

interface ViewLoadingTask {
    promise: Promise<AnyView>;
    componentReadyCallbacks: (() => void)[];
    isComponentReady: boolean;
    unloadRequested: boolean;
}

/** 负责 View 的异步加载、并发去重、层级和生命周期。 */
export class ViewService {
    private readonly views = new Map<string, AnyView>();
    private readonly loadingTasks = new Map<string, ViewLoadingTask>();
    private readonly activeViewNames: string[] = [];
    private readonly layers: Node[] = [];

    /** 初始化视图层级。 */
    constructor(
        private readonly services: ServiceLocator,
        private readonly registry: ViewDefinition.ViewRegistry,
        facadeNode: Node,
    ) {
        const layerNames = Object.keys(ViewDefinition.ViewLayer).filter((key) => Number.isNaN(Number(key)));
        for (const layerName of layerNames) {
            const layer = new Node(layerName);
            layer.setParent(facadeNode);

            const widget = layer.addComponent(Widget);
            widget.isAlignBottom = true;
            widget.isAlignLeft = true;
            widget.isAlignRight = true;
            widget.isAlignTop = true;
            widget.bottom = 0;
            widget.left = 0;
            widget.right = 0;
            widget.top = 0;

            this.layers.push(layer);
        }
    }

    /** 更新所有已激活视图。 */
    update(dt: number) {
        for (const viewName of this.activeViewNames) this.views.get(viewName)?.update(dt);
    }

    /** 加载视图。 */
    load<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey, ...params: ViewDefinition.ViewParams<TKey>): Promise<ViewDefinition.ViewInstance<TKey>> {
        return this.requestLoad(viewKey, undefined, params);
    }

    /** 加载视图，并在组件准备完成后执行回调。 */
    loadWithComponentReady<TKey extends ViewDefinition.AnyViewKey>(
        viewKey: TKey,
        onComponentReady: () => void,
        ...params: ViewDefinition.ViewParams<TKey>
    ): Promise<ViewDefinition.ViewInstance<TKey>> {
        return this.requestLoad(viewKey, onComponentReady, params);
    }

    /** 卸载视图；加载中则在加载完成后卸载。 */
    unload(viewKey: ViewDefinition.AnyViewKey) {
        const loadingTask = this.loadingTasks.get(viewKey.name);
        if (loadingTask) {
            loadingTask.unloadRequested = true;
            return;
        }
        this.unloadView(viewKey.name);
    }

    /** 判断视图是否处于激活状态。 */
    has(viewKey: ViewDefinition.AnyViewKey): boolean {
        return this.activeViewNames.includes(viewKey.name);
    }

    /** 判断视图是否位于激活视图栈顶。 */
    isTop(viewKey: ViewDefinition.AnyViewKey): boolean {
        return this.activeViewNames[this.activeViewNames.length - 1] === viewKey.name;
    }

    /** 获取已创建的视图。 */
    tryGet<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey): ViewDefinition.ViewInstance<TKey> | undefined {
        return this.views.get(viewKey.name) as ViewDefinition.ViewInstance<TKey> | undefined;
    }

    /** 复用进行中的加载任务，或创建新的加载任务。 */
    private async requestLoad<TKey extends ViewDefinition.AnyViewKey>(
        viewKey: TKey,
        onComponentReady: (() => void) | undefined,
        params: ViewDefinition.ViewParams<TKey>,
    ): Promise<ViewDefinition.ViewInstance<TKey>> {
        if (this.has(viewKey)) return this.tryGet(viewKey)!;

        const loadingTask = this.loadingTasks.get(viewKey.name);
        if (loadingTask) {
            if (onComponentReady) {
                if (loadingTask.isComponentReady) onComponentReady();
                else loadingTask.componentReadyCallbacks.push(onComponentReady);
            }
            return loadingTask.promise as Promise<ViewDefinition.ViewInstance<TKey>>;
        }

        const task: ViewLoadingTask = {
            promise: undefined!,
            componentReadyCallbacks: onComponentReady ? [onComponentReady] : [],
            isComponentReady: false,
            unloadRequested: false,
        };
        task.promise = this.loadView(viewKey, params, task);
        this.loadingTasks.set(viewKey.name, task);

        try {
            return (await task.promise) as ViewDefinition.ViewInstance<TKey>;
        } finally {
            if (this.loadingTasks.get(viewKey.name) === task) this.loadingTasks.delete(viewKey.name);
        }
    }

    /** 执行视图的完整加载流程。 */
    private async loadView<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey, params: ViewDefinition.ViewParams<TKey>, task: ViewLoadingTask): Promise<AnyView> {
        const viewCtor = this.registry.getViewCtor(viewKey.name);
        if (!viewCtor) throw new Error(`视图【${viewKey.name}】尚未注册`);

        const view = this.views.get(viewKey.name) ?? new viewCtor.ctor();
        this.views.set(viewKey.name, view);
        view.serve = this.services;
        view.viewConfig = {
            ...viewCtor,
            name: viewKey.name,
        };

        let component: BaseViewComponent<AnyView> | undefined;
        try {
            view.prepare();
            component = await this.loadViewComponent(view.viewConfig);
            component.view = view;

            task.isComponentReady = true;
            for (const callback of task.componentReadyCallbacks.splice(0)) callback();

            await view.load(component, ...params);
            this.activeViewNames.push(viewKey.name);
            log(`加载视图【${viewKey.name}】`);

            if (task.unloadRequested) this.unloadView(viewKey.name);
            return view;
        } catch (reason) {
            view.unload();
            if (component && !view.viewConfig.isScene && component.node.isValid) component.node.destroy();
            if (view.viewConfig.cache === false) this.views.delete(viewKey.name);
            error(`加载视图【${viewKey.name}】失败`, reason);
            throw reason;
        }
    }

    /** 加载场景或 Prefab，并获取视图组件。 */
    private async loadViewComponent(config: ViewDefinition.ViewConfig): Promise<BaseViewComponent<AnyView>> {
        if (config.isScene) {
            this.unloadCurrentSceneView();
            await this.services.assetService.loadScene(config.assetPath);

            const scene = director.getScene();
            const componentNode = scene ? find(config.componentNodePath ?? "Component", scene) : null;
            const component = componentNode?.getComponent(config.comp);
            if (!component) throw new Error(`场景视图【${config.name}】缺少组件节点【${config.componentNodePath ?? "Component"}】`);
            return component as BaseViewComponent<AnyView>;
        }

        const prefab = await this.services.assetService.load(config.assetPath, Prefab);
        const node = instantiate(prefab);
        const layer = config.layer ?? ViewDefinition.ViewLayer.Main;
        const parent = this.layers[layer];
        if (!parent) throw new Error(`视图层级无效：${layer}`);

        parent.addChild(node);
        const component = node.getComponent(config.comp);
        if (!component) {
            node.destroy();
            throw new Error(`预制体视图【${config.name}】缺少指定组件`);
        }
        return component as BaseViewComponent<AnyView>;
    }

    /** 卸载当前激活的场景视图。 */
    private unloadCurrentSceneView() {
        for (const viewName of this.activeViewNames) {
            const view = this.views.get(viewName);
            if (!view?.viewConfig.isScene) continue;

            this.unloadView(viewName);
            return;
        }
    }

    /** 卸载指定视图并清理状态。 */
    private unloadView(viewName: string) {
        const activeIndex = this.activeViewNames.indexOf(viewName);
        if (activeIndex < 0) return;

        const view = this.views.get(viewName);
        if (!view) return;

        if (!view.viewConfig.isScene && view.component.node.isValid) view.component.node.destroy();
        view.unload();
        this.activeViewNames.splice(activeIndex, 1);

        if (view.viewConfig.cache === false) this.views.delete(viewName);
        log(`卸载视图【${viewName}】`);
    }
}
