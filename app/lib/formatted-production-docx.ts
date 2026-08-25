import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  PageOrientation,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const NAVY = "17233B";
const GOLD = "B58B2A";
const CREAM = "F3EAD2";
const LIGHT_BLUE = "EAF0F8";
const LIGHT_GRAY = "F2F2F2";
const TEXT = "202936";
const MUTED = "68707B";
const GREEN = "2F6B46";
const AMBER = "9A6500";
const RED = "A61B1B";
const WHITE = "FFFFFF";
const FONT = "Tahoma";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "414955" } as const;
const CELL_MARGINS = { top: 90, bottom: 90, left: 90, right: 90 } as const;

export type ProductionBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "table"; rows: string[][] };

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function splitTableRow(line: string) {
  const clean = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return clean.split("|").map((cell) => stripMarkdown(cell.trim()));
}

function isSeparatorRow(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

export function parseProductionMarkdown(markdown: string): ProductionBlock[] {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ProductionBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const text = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: stripMarkdown(heading[2]),
      });
      continue;
    }

    if (/^\|/.test(line) && index + 1 < lines.length && isSeparatorRow(lines[index + 1])) {
      flushParagraph();
      const rows: string[][] = [splitTableRow(line)];
      index += 2;
      for (; index < lines.length; index += 1) {
        const tableLine = lines[index].trim();
        if (!/^\|/.test(tableLine)) {
          index -= 1;
          break;
        }
        if (!isSeparatorRow(tableLine)) rows.push(splitTableRow(tableLine));
      }
      blocks.push({ type: "table", rows });
      continue;
    }

    const bullet = line.match(/^(?:[-•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: "bullet", text: stripMarkdown(bullet[1]) });
      continue;
    }

    paragraphBuffer.push(line);
  }
  flushParagraph();
  return blocks;
}

function inlineRuns(text: string, options?: { color?: string; size?: number; bold?: boolean }) {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push(new TextRun({
        text: text.slice(cursor, match.index),
        font: FONT,
        size: options?.size ?? 20,
        color: options?.color ?? TEXT,
        bold: options?.bold,
      }));
    }
    runs.push(new TextRun({
      text: match[1],
      font: FONT,
      size: options?.size ?? 20,
      color: options?.color ?? TEXT,
      bold: true,
    }));
    cursor = regex.lastIndex;
  }
  if (cursor < text.length) {
    runs.push(new TextRun({
      text: text.slice(cursor),
      font: FONT,
      size: options?.size ?? 20,
      color: options?.color ?? TEXT,
      bold: options?.bold,
    }));
  }
  return runs.length ? runs : [new TextRun({ text, font: FONT, size: options?.size ?? 20, color: options?.color ?? TEXT, bold: options?.bold })];
}

function headingParagraph(text: string, level: number) {
  const isMain = level === 1;
  const color = level === 2 ? GOLD : NAVY;
  const size = isMain ? 34 : level === 2 ? 26 : 22;
  return new Paragraph({
    heading: isMain ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: isMain ? 280 : 180, after: 120 },
    keepNext: true,
    children: [new TextRun({ text, font: FONT, bold: true, size, color })],
  });
}

function bodyParagraph(text: string, options?: { bold?: boolean; color?: string; center?: boolean; before?: number; after?: number }) {
  return new Paragraph({
    alignment: options?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: options?.before ?? 0, after: options?.after ?? 100, line: 276 },
    children: inlineRuns(text, { color: options?.color, bold: options?.bold, size: 20 }),
  });
}

function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 270 },
    children: inlineRuns(text, { size: 20 }),
  });
}

function callout(text: string, emphasis = false) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: CELL_MARGINS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: CREAM, type: ShadingType.CLEAR },
            borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
            margins: { top: 180, bottom: 180, left: 220, right: 220 },
            children: [new Paragraph({
              spacing: { after: 0, line: 300 },
              children: inlineRuns(text, { bold: emphasis, size: emphasis ? 23 : 21, color: NAVY }),
            })],
          }),
        ],
      }),
    ],
  });
}

function decisionColor(text: string) {
  const upper = text.toUpperCase();
  if (upper.includes("REMOVE")) return RED;
  if (upper.includes("VERIFY")) return AMBER;
  if (upper.includes("KEEP") || upper.includes("TIGHTEN")) return GREEN;
  return TEXT;
}

function riskColor(text: string) {
  const upper = text.toUpperCase();
  if (upper === "RED") return RED;
  if (upper === "AMBER") return AMBER;
  return TEXT;
}

function tableCellParagraph(text: string, header: string, column: number, isVoTable: boolean) {
  const trimmed = stripMarkdown(text);
  let color = TEXT;
  let bold = false;
  if (/Lēmums/i.test(header)) {
    color = decisionColor(trimmed);
    bold = color !== TEXT;
  }
  if (/Līmenis/i.test(header) && column === 0) {
    color = riskColor(trimmed);
    bold = color !== TEXT;
  }
  if (isVoTable && column === 0 && /^\d{1,2}:\d{2}/.test(trimmed)) {
    color = GOLD;
    bold = true;
  }
  return new Paragraph({
    spacing: { after: 0, line: 250 },
    children: [new TextRun({ text: trimmed, font: FONT, size: 18, color, bold })],
  });
}

function buildProductionTable(rows: string[][]) {
  if (!rows.length) return null;
  const headers = rows[0];
  const isVoTable = headers.some((header) => /GALA VO TEKSTS/i.test(header));
  const isRiskTable = headers.some((header) => /Līmenis/i.test(header));
  const isDecisionTable = headers.some((header) => /Lēmums/i.test(header));
  const stripe = isVoTable ? LIGHT_BLUE : isRiskTable || isDecisionTable ? LIGHT_GRAY : LIGHT_BLUE;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: CELL_MARGINS,
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        tableHeader: rowIndex === 0,
        cantSplit: rowIndex !== 0,
        children: headers.map((header, column) => {
          const value = row[column] ?? "";
          return new TableCell({
            shading: rowIndex === 0
              ? { fill: NAVY, type: ShadingType.CLEAR }
              : rowIndex % 2 === 1
                ? { fill: stripe, type: ShadingType.CLEAR }
                : undefined,
            borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
            margins: CELL_MARGINS,
            children: rowIndex === 0
              ? [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [new TextRun({ text: stripMarkdown(value), font: FONT, size: 18, bold: true, color: WHITE })],
                })]
              : [tableCellParagraph(value, header, column, isVoTable)],
          });
        }),
      }),
    ),
  });
}

function blockChildren(blocks: ProductionBlock[]) {
  const children: Array<Paragraph | Table> = [];
  let calloutNext = false;
  for (const block of blocks) {
    if (block.type === "heading") {
      children.push(headingParagraph(block.text, block.level));
      calloutNext = /Galīgā producenta rekomendācija|Epizodes caurviju motīvs/i.test(block.text);
      continue;
    }
    if (block.type === "table") {
      const table = buildProductionTable(block.rows);
      if (table) children.push(table);
      children.push(new Paragraph({ spacing: { after: 100 } }));
      calloutNext = false;
      continue;
    }
    if (block.type === "bullet") {
      children.push(bulletParagraph(block.text));
      calloutNext = false;
      continue;
    }
    if (/^EP LĒMUMS:/i.test(block.text) || calloutNext) {
      children.push(callout(block.text, calloutNext));
      children.push(new Paragraph({ spacing: { after: 80 } }));
      calloutNext = false;
      continue;
    }
    children.push(bodyParagraph(block.text));
    calloutNext = false;
  }
  return children;
}

function deriveSubject(fileName: string) {
  const clean = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^GIV[\s_-]*/i, "")
    .replace(/\b(?:melna|montāža|montaza|labots|ar|VO)\b/gi, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
  const first = clean.split(" ").filter(Boolean)[0] || "PRODUCTION";
  return first.toLocaleUpperCase("lv-LV");
}

function footer(subject: string) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `DANA AI  |  ${subject}  |  `, font: FONT, size: 16, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: TEXT }),
        ],
      }),
    ],
  });
}

function splitProductionSections(markdown: string) {
  const source = String(markdown || "").trim();
  const master = source.search(/^#{1,3}\s*4\.\s*VO MASTER\b/im);
  const after = source.search(/^#{1,3}\s*5\.\s*Teaseri\b/im);
  if (master < 0) return { before: source, master: "", after: "" };
  return {
    before: source.slice(0, master).trim(),
    master: source.slice(master, after > master ? after : source.length).trim(),
    after: after > master ? source.slice(after).trim() : "",
  };
}

function coverChildren({ fileName, tone, exportedAt, ratioLine }: { fileName: string; tone: string; exportedAt: string; ratioLine?: string }) {
  const subject = deriveSubject(fileName);
  return [
    new Paragraph({ spacing: { before: 200, after: 70 }, children: [new TextRun({ text: subject, font: FONT, bold: true, size: 54, color: NAVY })] }),
    new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "PRODUKCIJAS ANALĪZE UN VO SCENĀRIJS", font: FONT, bold: true, size: 30, color: NAVY })] }),
    new Paragraph({ spacing: { after: 260 }, children: [new TextRun({ text: "“Gandrīz ideālas vakariņas”", font: FONT, bold: true, size: 24, color: GOLD })] }),
    callout(`REŽISORISKĀ FORMULA: ${tone}. VO darbojas kā “piektā vakariņotāja” balss — klātesoša saturā, ar viedokli, humoru un cieņu pret dalībniekiem.`, true),
    new Paragraph({ spacing: { before: 280, after: 60 }, children: [new TextRun({ text: "DANA AI — Master Production System v2.0", font: FONT, bold: true, size: 22, color: NAVY })] }),
    bodyParagraph("Production-ready darba versija producentam, montāžas režisoram un VO ierakstam.", { color: MUTED }),
    bodyParagraph(`Sagatavots: ${exportedAt}`, { color: MUTED }),
    bodyParagraph(`Avots: ${fileName}. Gala dokuments saglabā DANA AI analīzes struktūru, VO MASTER un redakcionālās piezīmes.`, { color: MUTED }),
    ...(ratioLine ? [bodyParagraph(ratioLine, { color: MUTED })] : []),
    new Paragraph({ pageBreakBefore: true, spacing: { after: 0 } }),
  ];
}

export function buildFormattedProductionDocx({
  markdown,
  fileName,
  tone,
  exportedAt,
  ratioLine,
}: {
  markdown: string;
  fileName: string;
  tone: string;
  exportedAt: string;
  ratioLine?: string;
}) {
  const subject = deriveSubject(fileName);
  const sections = splitProductionSections(markdown);
  const portraitChildren = [
    ...coverChildren({ fileName, tone, exportedAt, ratioLine }),
    ...blockChildren(parseProductionMarkdown(sections.before)),
  ];
  const landscapeChildren = sections.master
    ? blockChildren(parseProductionMarkdown(sections.master))
    : [];
  const afterChildren = sections.after
    ? blockChildren(parseProductionMarkdown(sections.after))
    : [];

  return new Document({
    creator: "DANA AI Production Studio",
    title: `${subject} — Production Analysis and VO`,
    description: "Production-ready formatted DANA AI editorial analysis and voice-over script.",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20, color: TEXT },
          paragraph: { spacing: { after: 100, line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 936, bottom: 936, left: 1008, right: 1008 } },
        },
        footers: { default: footer(subject) },
        children: portraitChildren,
      },
      ...(landscapeChildren.length
        ? [{
            properties: {
              type: SectionType.NEXT_PAGE,
              page: {
                size: { orientation: PageOrientation.LANDSCAPE },
                margin: { top: 720, bottom: 720, left: 792, right: 792 },
              },
            },
            footers: { default: footer(subject) },
            children: landscapeChildren,
          }]
        : []),
      ...(afterChildren.length
        ? [{
            properties: {
              type: SectionType.NEXT_PAGE,
              page: {
                size: { orientation: PageOrientation.PORTRAIT },
                margin: { top: 936, bottom: 936, left: 1008, right: 1008 },
              },
            },
            footers: { default: footer(subject) },
            children: afterChildren,
          }]
        : []),
    ],
  });
}
