export interface SocketOptions {
    readonly binaryType?: "blob" | "arraybuffer";
    readonly reconnectAttempts?: number;
    readonly reconnectDelayMs?: number;
}

export interface SocketHandlers {
    readonly onOpen?: (socketId: number) => void;
    readonly onMessage?: (data: string | ArrayBuffer | Blob, socketId: number) => void;
    readonly onError?: (event: Event, socketId: number) => void;
    readonly onClose?: (event: CloseEvent, socketId: number) => void;
}

interface SocketRecord {
    readonly handlers: SocketHandlers;
    readonly options: Required<SocketOptions>;
    socket?: WebSocket;
    url?: string;
    reconnectCount: number;
    manuallyClosed: boolean;
}

/** 不预设握手和消息协议的 WebSocket 管理器。 */
export class SocketNet {
    private readonly sockets: Array<SocketRecord | undefined> = [];

    addSocket(handlers: SocketHandlers = {}, options: SocketOptions = {}): number {
        const record: SocketRecord = {
            handlers,
            options: {
                binaryType: options.binaryType ?? "arraybuffer",
                reconnectAttempts: options.reconnectAttempts ?? 0,
                reconnectDelayMs: options.reconnectDelayMs ?? 1000,
            },
            reconnectCount: 0,
            manuallyClosed: false,
        };

        const emptyIndex = this.sockets.findIndex((value) => value === undefined);
        if (emptyIndex >= 0) {
            this.sockets[emptyIndex] = record;
            return emptyIndex;
        }
        return this.sockets.push(record) - 1;
    }

    connect(socketId: number, url: string) {
        const record = this.requireSocket(socketId);
        this.closeWebSocket(record);
        record.url = url;
        record.reconnectCount = 0;
        record.manuallyClosed = false;
        this.open(socketId, record);
    }

    isConnected(socketId: number): boolean {
        return this.requireSocket(socketId).socket?.readyState === WebSocket.OPEN;
    }

    send(socketId: number, data: string | ArrayBuffer | ArrayBufferView | Blob): boolean {
        const socket = this.requireSocket(socketId).socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) return false;
        socket.send(data);
        return true;
    }

    close(socketId: number, code?: number, reason?: string) {
        const record = this.requireSocket(socketId);
        record.manuallyClosed = true;
        record.socket?.close(code, reason);
    }

    remove(socketId: number) {
        const record = this.requireSocket(socketId);
        record.manuallyClosed = true;
        this.closeWebSocket(record);
        this.sockets[socketId] = undefined;
    }

    closeAll() {
        for (const record of this.sockets) {
            if (!record) continue;
            record.manuallyClosed = true;
            this.closeWebSocket(record);
        }
    }

    private open(socketId: number, record: SocketRecord) {
        if (!record.url) throw new Error(`Socket ${socketId} 缺少连接地址`);
        const socket = new WebSocket(record.url);
        record.socket = socket;
        socket.binaryType = record.options.binaryType;
        socket.onopen = () => {
            record.reconnectCount = 0;
            record.handlers.onOpen?.(socketId);
        };
        socket.onmessage = (event) => record.handlers.onMessage?.(event.data, socketId);
        socket.onerror = (event) => record.handlers.onError?.(event, socketId);
        socket.onclose = (event) => {
            if (record.socket === socket) record.socket = undefined;
            record.handlers.onClose?.(event, socketId);
            if (record.manuallyClosed || record.reconnectCount >= record.options.reconnectAttempts) return;
            record.reconnectCount++;
            setTimeout(() => {
                if (!record.manuallyClosed && this.sockets[socketId] === record) this.open(socketId, record);
            }, record.options.reconnectDelayMs);
        };
    }

    private closeWebSocket(record: SocketRecord) {
        const socket = record.socket;
        if (!socket) return;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        record.socket = undefined;
    }

    private requireSocket(socketId: number): SocketRecord {
        const socket = this.sockets[socketId];
        if (!socket) throw new Error(`Socket ID 无效：${socketId}`);
        return socket;
    }
}
