import { Component, Constructor } from "cc";
import type { AnyView, BaseView } from "./BaseView";
import type { BaseViewComponent } from "./BaseViewComponent";

export namespace ViewDefinition {
    export interface ViewKey<TView extends AnyView = AnyView> {
        readonly name: string;
        readonly viewType?: TView;
    }

    export type AnyViewKey = ViewKey<any>;
    export type ViewInstance<TKey extends AnyViewKey> = TKey extends ViewKey<infer TView> ? TView : never;
    export type ViewParams<TKey extends AnyViewKey> = ViewInstance<TKey> extends BaseView<any, infer TParams> ? TParams : never;

    export function defineView<TView extends AnyView>(name: string): ViewKey<TView> {
        return { name };
    }

    export interface ViewConstructor {
        readonly ctor: new () => AnyView;
        readonly comp: Constructor<BaseViewComponent<AnyView> | Component>;
        /** 业务根目录，其下按 scene、prefab、audio 分类存放资源。 */
        readonly path: string;
        readonly isScene?: boolean;
        readonly componentNodePath?: string;
        readonly layer?: ViewLayer;
        readonly cache?: boolean;
    }

    export interface ViewConfig extends ViewConstructor {
        readonly name: string;
    }

    export interface ViewRegistration {
        readonly key: AnyViewKey;
        readonly config: ViewConstructor;
    }

    export interface ViewSchema {
        readonly sharedPath: string;
        readonly entryView: AnyViewKey;
        readonly preloadViews?: readonly AnyViewKey[];
        readonly views: readonly ViewRegistration[];
    }

    export interface ViewRegistry {
        getViewCtor(viewName: string): ViewConstructor | undefined;
    }

    export enum ViewLayer {
        Background,
        Main,
        Popup,
        Guide,
        System,
    }
}
