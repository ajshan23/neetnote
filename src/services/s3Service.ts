import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// S3 client config
const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId:process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey:process.env.SECRET_KEY!,
  },
});

/**
 * Upload a file to a specific S3 folder
 * @param localFilePath - local file path
 * @param bucketName - S3 bucket name
 * @param folderName - folder prefix in S3
 * @returns uploaded file URL
 */
export const uploadToS3 = async (
  localFilePath: string,
  bucketName: string,
  folderName: string
): Promise<string> => {
  // Ensure folder ends with '/'
  if (!folderName.endsWith("/")) folderName += "/";

  const fileContent = fs.readFileSync(localFilePath);
  const fileName = path.basename(localFilePath);
  const s3Key = `${folderName}${fileName}`;

  const command = new PutObjectCommand({
    Bucket: "krishnadas-test-1",
    Key: s3Key,
    Body: fileContent,
  });

  await s3.send(command);

  // Return public URL
  return `https://${bucketName}.s3.ap-south-1.amazonaws.com/${s3Key}`;
};
