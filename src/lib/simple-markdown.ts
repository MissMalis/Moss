// Rev 04 §3: the advisor prompt already asks for plain text, but LLMs
// don't always comply — this is the safety net so `**bold**` never shows
// up as literal asterisks. Only handles bold; anything fancier than that
// isn't worth a markdown dependency for one text field.

export interface TextSegment {
  text: string;
  bold: boolean;
}

export function parseBoldSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  return segments;
}
