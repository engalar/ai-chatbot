import { openai, createOpenAI } from "@ai-sdk/openai";
import { experimental_wrapLanguageModel as wrapLanguageModel } from "ai";
import { HttpsProxyAgent } from "https-proxy-agent";
import https, { RequestOptions } from "https";
import { customMiddleware } from "./custom-middleware";
const agent = new HttpsProxyAgent(process.env.https_proxy!);
console.log("apply proxy: "+process.env.https_proxy);
const customOpenAI = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  async fetch(input, init) {
    init = init || {};
    const url = new URL(input as string);
    const body: string = await new Promise((resolve, reject) => {
      const req = https.request({ agent, path: url.pathname, port: url.port, host: url.host, hostname: url.hostname, href: url.href, protocol: url.protocol, origin: url.origin, searchParams: url.searchParams, headers: init.headers, method: init.method } as RequestOptions, res => {
        console.log(`状态码: ${res.statusCode}`);
        let rawData = '';

        // 监听数据块
        res.on('data', (chunk) => {
          rawData += chunk; // 将每个 chunk 累加到 rawData
        });

        // 数据接收完毕
        res.on('end', () => {
          try {
            resolve(rawData);
          } catch (e) {
            reject(e);
          }
        });
      })
      req.on('error', (e) => {
        console.error(`请求遇到问题: ${e.message}`);
        debugger
      });
      req.write(init.body);
      req.end();
    });
    return new Response(body);
  },
});

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: customOpenAI(apiIdentifier),
    middleware: customMiddleware,
  });
};
