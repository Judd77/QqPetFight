export const enum HttpMethod {
    Get = "GET",
    Post = "POST",
    Put = "PUT",
    Patch = "PATCH",
    Delete = "DELETE",
}

export interface HttpRequestOptions {
    readonly headers?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
    readonly retries?: number;
}

export interface HttpResponse<T> {
    readonly status: number;
    readonly data: T;
}

export class HttpError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly response?: unknown,
    ) {
        super(message);
    }
}

export type HttpResponseTransformer = (data: unknown, status: number) => unknown;

/** 基于 XMLHttpRequest 的 Promise HTTP 客户端。 */
export class HttpNet {
    private readonly headers = new Map<string, string>();
    private responseTransformer: HttpResponseTransformer = (data) => data;

    setHeader(name: string, value?: string) {
        if (value) this.headers.set(name, value);
        else this.headers.delete(name);
    }

    setResponseTransformer(transformer?: HttpResponseTransformer) {
        this.responseTransformer = transformer ?? ((data) => data);
    }

    request<TResponse>(method: HttpMethod, url: string, data?: object, options: HttpRequestOptions = {}): Promise<HttpResponse<TResponse>> {
        const retries = options.retries ?? 2;
        return this.send<TResponse>(method, url, data, options, retries);
    }

    private send<TResponse>(method: HttpMethod, url: string, data: object | undefined, options: HttpRequestOptions, retries: number): Promise<HttpResponse<TResponse>> {
        return new Promise<HttpResponse<TResponse>>((resolve, reject) => {
            const requestUrl = method === HttpMethod.Get ? this.appendQuery(url, data) : url;
            const xhr = new XMLHttpRequest();
            xhr.open(method, requestUrl, true);
            xhr.timeout = options.timeoutMs ?? 10000;
            this.applyHeaders(xhr, options.headers);

            xhr.onload = () => {
                const payload = this.parsePayload(xhr.responseText);
                if (xhr.status < 200 || xhr.status >= 400) {
                    reject(new HttpError(`HTTP ${xhr.status}：${requestUrl}`, xhr.status, payload));
                    return;
                }

                try {
                    const transformed = this.responseTransformer(payload, xhr.status) as TResponse;
                    resolve({ status: xhr.status, data: transformed });
                } catch (error) {
                    reject(error);
                }
            };

            const retryOrReject = (message: string) => {
                if (retries > 0) {
                    this.send<TResponse>(method, url, data, options, retries - 1).then(resolve, reject);
                    return;
                }
                reject(new HttpError(message, xhr.status));
            };

            xhr.onerror = () => retryOrReject(`网络请求失败：${requestUrl}`);
            xhr.ontimeout = () => retryOrReject(`网络请求超时：${requestUrl}`);

            const body = method === HttpMethod.Get || data === undefined ? undefined : JSON.stringify(data);
            if (body !== undefined && !this.headers.has("Content-Type") && !options.headers?.["Content-Type"]) {
                xhr.setRequestHeader("Content-Type", "application/json");
            }
            xhr.send(body ?? null);
        });
    }

    private applyHeaders(xhr: XMLHttpRequest, headers?: Readonly<Record<string, string>>) {
        for (const [name, value] of this.headers) xhr.setRequestHeader(name, value);
        if (!headers) return;
        for (const name of Object.keys(headers)) xhr.setRequestHeader(name, headers[name]!);
    }

    private appendQuery(url: string, data?: object): string {
        if (!data) return url;
        const query = Object.keys(data)
            .filter((key) => (data as Record<string, unknown>)[key] !== undefined)
            .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String((data as Record<string, unknown>)[key]))}`)
            .join("&");
        if (!query) return url;
        return `${url}${url.indexOf("?") >= 0 ? "&" : "?"}${query}`;
    }

    private parsePayload(value: string): unknown {
        if (!value) return undefined;
        try {
            return JSON.parse(value) as unknown;
        } catch {
            return value;
        }
    }
}
