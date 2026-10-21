declare module 'node-media-server' {
  interface NodeMediaServerConfig {
    rtmp?: {
      port?: number;
      chunk_size?: number;
      gop_cache?: boolean;
      ping?: number;
      ping_timeout?: number;
      ssl?: {
        port?: number;
        key?: string;
        cert?: string;
      };
    };
    http?: {
      port?: number;
      allow_origin?: string;
      mediaroot?: string;
    };
    auth?: {
      play?: boolean;
      publish?: boolean;
      secret?: string;
    };
    trans?: any;
    fission?: any;
  }

  export default class NodeMediaServer {
    constructor(config: NodeMediaServerConfig);
    run(): void;
    stop(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    getSession(id: string): any;
  }
}
