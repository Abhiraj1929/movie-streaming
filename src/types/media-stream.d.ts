export {};

declare global {
  interface HTMLVideoElement {
    captureStream(): MediaStream;
  }

  interface HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream;
  }

  interface Window {
    __WATCH_PARTY_ROOM: any;
    __WATCH_PARTY_PARTICIPANT: any;
    __WATCH_PARTY_PARTICIPANTS: any[];
    __WATCH_PARTY_MESSAGES: any[];
    __WATCH_PARTY_ERROR: string | null;
  }
}
