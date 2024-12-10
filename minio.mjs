import { Client } from "minio";
import { createHash } from "crypto";
import { createReadStream, ReadStream } from "fs";
import { config } from "dotenv";
import fs from "fs";

config();

/**
 * MinIO 客户端类，封装常用操作
 */
class MinioService {
  constructor({ endPoint, port, useSSL, accessKey, secretKey, bucketName }) {
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
  async doesObjectExist(objectName) {
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
  async uploadFile(objectName, fileSource) {
    if (typeof fileSource === "string") {
      // 如果是文件路径，使用 fPutObject
      await this.client.fPutObject(this.bucketName, objectName, fileSource);
    } else {
      // 如果是流，使用 putObject
      // new File().arrayBuffer()
      const data = await fileSource.arrayBuffer();
      await this.client.putObject(this.bucketName, objectName, Buffer.from(data));
    }
  }

  /**
   * 生成公开 URL
   * @param {string} objectName 对象名
   * @param {number} expiry 有效期（秒）
   * @returns {Promise<string>}
   */
  async generatePublicUrl(objectName, expiry = 300) {
    return this.client.presignedGetObject(this.bucketName, objectName, expiry);
  }
}

/**
 * 计算文件哈希值
 * @param {NodeJS.ReadableStream | string} fileSource 文件来源，可以是流或路径
 * @returns {Promise<string>}
 */
async function calculateHash(fileSource) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    if (typeof fileSource === "string") {
      const stream = createReadStream(fileSource);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    } else {
      const chunk = fileSource.arrayBuffer();
      hash.update('' + chunk);
      resolve(hash.digest("hex"));
    }
  });
}

// 初始化 MinioService 实例
const minioService = new MinioService({
  endPoint: process.env.MINIO_ENDPOINT,
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  bucketName: process.env.MINIO_BUCKET,
});

/**
 * 上传文件并生成公开 URL
 * @param {NodeJS.ReadableStream | string} fileSource 文件来源，可以是流或路径
 * @returns {Promise<string>}
 */
async function uploadAndGetUrl(fileSource) {
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
    const result = {
      url,
      "pathname": "/" + fileName,
      "contentType": "img/png",
    };

    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// 示例调用：支持路径和 File 类型
(async () => {
  const filePath = "package.json"; // 文件路径示例
  const fileUrl = await uploadAndGetUrl(filePath);
  console.log("Generated URL from file path:", fileUrl);

  const fileStream = createReadStream("tsconfig.json"); // 模拟文件流
  const data = fs.readFileSync("tsconfig.json");
  const file = new File([data], "tsconfig.json", { type: 'text/plain' });
  const streamUrl = await uploadAndGetUrl(file);
  console.log("Generated URL from stream:", streamUrl);
})();
