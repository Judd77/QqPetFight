import { HttpMethod, HttpNet, HttpRequestOptions, HttpResponse, HttpResponseTransformer } from "./HttpNet";
import { SocketHandlers, SocketNet, SocketOptions } from "./SocketNet";

/** HTTP 与 WebSocket 的通用入口。 */
export class NetService {
    private readonly http = new HttpNet();
    private readonly sockets = new SocketNet();
    private baseUrl = "";

    setBaseUrl(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    setHeader(name: string, value?: string) {
        this.http.setHeader(name, value);
    }

    setResponseTransformer(transformer?: HttpResponseTransformer) {
        this.http.setResponseTransformer(transformer);
    }

    get<TResponse>(path: string, query?: object, options?: HttpRequestOptions): Promise<HttpResponse<TResponse>> {
        return this.http.request<TResponse>(HttpMethod.Get, this.resolveUrl(path), query, options);
    }

    post<TResponse, TBody extends object = object>(path: string, body?: TBody, options?: HttpRequestOptions): Promise<HttpResponse<TResponse>> {
        return this.http.request<TResponse>(HttpMethod.Post, this.resolveUrl(path), body, options);
    }

    request<TResponse>(method: HttpMethod, path: string, data?: object, options?: HttpRequestOptions): Promise<HttpResponse<TResponse>> {
        return this.http.request<TResponse>(method, this.resolveUrl(path), data, options);
    }

    addSocket(handlers?: SocketHandlers, options?: SocketOptions): number {
        return this.sockets.addSocket(handlers, options);
    }

    connectSocket(socketId: number, url: string) {
        this.sockets.connect(socketId, url);
    }

    isSocketConnected(socketId: number): boolean {
        return this.sockets.isConnected(socketId);
    }

    sendSocket(socketId: number, data: string | ArrayBuffer | ArrayBufferView | Blob): boolean {
        return this.sockets.send(socketId, data);
    }

    closeSocket(socketId: number, code?: number, reason?: string) {
        this.sockets.close(socketId, code, reason);
    }

    removeSocket(socketId: number) {
        this.sockets.remove(socketId);
    }

    destroy() {
        this.sockets.closeAll();
    }

    private resolveUrl(path: string): string {
        if (/^https?:\/\//i.test(path)) return path;
        if (!this.baseUrl) throw new Error("HTTP Base URL 尚未设置");
        return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    }
}
