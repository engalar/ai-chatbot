import { Client } from "minio";
import { createHash } from "crypto";
import { createReadStream } from "fs";
// import { config } from "dotenv";

// config({path: '.env.play'});

export interface Option {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
}

/**
 * MinIO 客户端类，封装常用操作
 */
class MinioService {
  client: Client;
  bucketName: string;
  constructor({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
    bucketName,
  }: Option) {
    this.bucketName = bucketName;
    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  /**
   * 检查对象是否存在
   * @param {string} objectName 对象名
   * @returns {Promise<boolean>}
   */
  async doesObjectExist(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, objectName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 上传文件
   * @param {string} objectName 对象名
   * @param {NodeJS.ReadableStream | string} fileSource 文件来源，可以是流或路径
   * @returns {Promise<void>}
   */
  async uploadFile(
    objectName: string,
    fileSource: string | File,
  ): Promise<void> {
    if (typeof fileSource === "string") {
      // 如果是文件路径，使用 fPutObject
      await this.client.fPutObject(this.bucketName, objectName, fileSource);
    } else {
      // 如果是流，使用 putObject
      // new File().arrayBuffer()
      const data = await fileSource.arrayBuffer();
      await this.client.putObject(
        this.bucketName,
        objectName,
        Buffer.from(data),
      );
    }
  }

  /**
   * 生成公开 URL
   * @param {string} objectName 对象名
   * @param {number} expiry 有效期（秒）
   * @returns {Promise<string>}
   */
  async generatePublicUrl(objectName: string, expiry = 300): Promise<string> {
    return this.client.presignedGetObject(this.bucketName, objectName, expiry);
  }
}

/**
 * 计算文件哈希值
 * @param {NodeJS.ReadableStream | string} fileSource 文件来源，可以是流或路径
 * @returns {Promise<string>}
 */
async function calculateHash(fileSource: string | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    if (typeof fileSource === "string") {
      const stream = createReadStream(fileSource);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    } else {
      const chunk = fileSource.arrayBuffer();
      hash.update("" + chunk);
      resolve(hash.digest("hex"));
    }
  });
}

// 初始化 MinioService 实例
const minioService = new MinioService({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: +process.env.MINIO_PORT!,
  useSSL: true,// FIXME: hard code
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  bucketName: process.env.MINIO_BUCKET!,
});

/**
 * 上传文件并生成公开 URL
 * @param {NodeJS.ReadableStream | string} fileSource 文件来源，可以是流或路径
 * @returns {Promise<string>}
 */
export async function uploadToMinio(fileSource: string | File) {
  try {
    const hash = await calculateHash(fileSource);
    const fileName = hash; // 使用哈希值作为对象名

    const exists = await minioService.doesObjectExist(fileName);
    if (!exists) {
      await minioService.uploadFile(fileName, fileSource);
      console.log("File uploaded successfully.");
    } else {
      console.log("File already exists. Reusing existing object.");
    }

    const url = await minioService.generatePublicUrl(fileName);
    console.log("Public URL:", url);
    // FIXME: I need a https server to make openai happy
    const result = {
      // url: 'https://i.ibb.co/5Y0bPC0/entity.png',
      url,
      pathname: "/" + fileName,
      // pathname: "/entity.png",
      contentType: "image/png",
    };

    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
