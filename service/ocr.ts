import TextRecognition, {
  TextRecognitionScript,
  type TextLine,
  type TextRecognitionResult,
} from "@react-native-ml-kit/text-recognition";

export type OcrResult = {
  text: string;
  layoutText: string;
  rawText: string;
  raw: TextRecognitionResult;
};

type PositionedLine = {
  text: string;
  left: number;
  top: number;
  height: number;
  centerY: number;
};

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 12;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function toPositionedLine(line: TextLine): PositionedLine | null {
  const text = line.text.trim();
  if (!text || !line.frame) {
    return null;
  }

  return {
    text,
    left: line.frame.left,
    top: line.frame.top,
    height: line.frame.height,
    centerY: line.frame.top + line.frame.height / 2,
  };
}

function buildLayoutText(result: TextRecognitionResult) {
  const lines = result.blocks
    .flatMap((block) => block.lines)
    .map(toPositionedLine)
    .filter((line): line is PositionedLine => line !== null);

  if (lines.length === 0) {
    return "";
  }

  const medianHeight = getMedian(lines.map((line) => line.height));
  const rowTolerance = Math.max(8, medianHeight * 0.65);
  const rows: PositionedLine[][] = [];

  for (const line of [...lines].sort((a, b) => a.centerY - b.centerY || a.left - b.left)) {
    const row = rows.find((item) => {
      const rowCenterY =
        item.reduce((sum, rowLine) => sum + rowLine.centerY, 0) / item.length;
      return Math.abs(rowCenterY - line.centerY) <= rowTolerance;
    });

    if (row) {
      row.push(line);
    } else {
      rows.push([line]);
    }
  }

  return rows
    .map((row) =>
      row
        .sort((a, b) => a.left - b.left)
        .map((line) => line.text)
        .join(" | "),
    )
    .join("\n");
}

export async function recognizePaymentScreenshot(imageUri: string): Promise<OcrResult> {
  const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.CHINESE);
  const layoutText = buildLayoutText(result);
  const rawText = result.text.trim();

  return {
    text: layoutText || rawText,
    layoutText,
    rawText,
    raw: result,
  };
}
