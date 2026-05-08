type QueuedRequest = {
  url: string;
  options: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: any) => void;
};

const requestQueue: QueuedRequest[] = [];
let processing = false;
const MIN_INTERVAL = 200; // ~5 req/s to avoid Gemini rate limits

async function drainQueue() {
  if (processing) return;
  processing = true;
  while (requestQueue.length > 0) {
    const { url, options, resolve, reject } = requestQueue.shift()!;
    try {
      const response = await fetch(url, options);
      resolve(response);
    } catch (error) {
      reject(error);
    }
    if (requestQueue.length > 0) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL));
    }
  }
  processing = false;
}

export function throttledFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, options, resolve, reject });
    drainQueue(); // Only starts processing when there's work
  });
}
