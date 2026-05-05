import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export type CompressedImportImage = {
  sourceUri: string;
  uri: string;
  width: number;
  height: number;
  mimeType: "image/webp";
  dataUrl: string;
};

export async function compressImageForLlm(sourceUri: string): Promise<CompressedImportImage> {
  const result = await manipulateAsync(
    sourceUri,
    [],
    {
      base64: true,
      compress: 0.8,
      format: SaveFormat.WEBP,
    },
  );

  if (!result.base64) {
    throw new Error("Image compression did not return base64 data.");
  }

  return {
    sourceUri,
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: "image/webp",
    dataUrl: `data:image/webp;base64,${result.base64}`,
  };
}

export async function compressImagesForLlm(sourceUris: string[]): Promise<CompressedImportImage[]> {
  return Promise.all(sourceUris.map((sourceUri) => compressImageForLlm(sourceUri)));
}
