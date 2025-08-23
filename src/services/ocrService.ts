// src/services/ocrService.ts
import Tesseract from "tesseract.js";
import { Mistral } from "@mistralai/mistralai";
import fs from "fs";

const mistralClient = new Mistral({ apiKey: "Zg5f3MlW5tMDlQx7OjrKRIWv32O3JaL6"});

export const extractTextFromScreenshot = async (filePath: string): Promise<string> => {
  const { data } = await Tesseract.recognize(filePath, "eng");
  return data.text;
};

export const extractTextFromCameraImage = async (imageUrl: string): Promise<string> => {
  const ocrResponse = await mistralClient.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "image_url", // <- must be "image_url" for S3 links
      imageUrl: imageUrl,
    },
    // includeDiagrams: true, // optional
  });
  console.log(ocrResponse)
  return ocrResponse?.pages[0].markdown;
};