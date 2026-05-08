declare module "turndown-plugin-gfm" {
  export function gfm(turndown: any): void;
}

declare module "@kenjiuno/msgreader" {
  export default class MsgReader {
    constructor(buffer: Buffer);
    getFileData(): {
      senderName?: string;
      senderEmail?: string;
      to?: string;
      subject?: string;
      creationTime?: string;
      body?: string;
      bodyHTML?: string;
    };
  }
}
