const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  ShadingType,
  VerticalAlign,
} = require('docx');

const outDir = path.join(__dirname, '..', 'storage');
const outFile = path.join(outDir, 'starter.docx');

fs.mkdirSync(outDir, { recursive: true });

const NAVY = '1F1F3D';

const headerCell = (text) =>
  new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })] })],
  });

const dataCell = (text) =>
  new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ text })],
  });

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({ text: 'Murder Under Indian Law', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          text: 'This lesson covers the distinction between culpable homicide and murder under Indian criminal law, the statutory exceptions that can reduce a murder charge, and the applicable punishment framework.',
        }),

        new Paragraph({ text: 'Defining the Offence', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          text: 'Section 299 of the Indian Penal Code defines culpable homicide as causing death by an act done with the intention of causing death, or with the intention of causing such bodily injury as is likely to cause death, or with knowledge that the act is likely to cause death.',
        }),
        new Paragraph({
          text: 'Section 300 elevates culpable homicide to murder where one of four specified aggravating conditions is present — most centrally, an intention to cause death, or an intention to cause a bodily injury sufficient in the ordinary course of nature to cause death.',
        }),

        new Paragraph({ text: 'Exceptions to Murder', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Exception 1 — grave and sudden provocation', bullet: { level: 0 } }),
        new Paragraph({ text: 'Exception 4 — a sudden fight without premeditation, absent undue advantage or cruelty', bullet: { level: 0 } }),
        new Paragraph({
          text: 'Where an exception applies, the offence is reduced from murder to culpable homicide not amounting to murder, punishable under Section 304.',
        }),

        new Paragraph({ text: 'Punishment Framework', heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [headerCell('Section'), headerCell('Offence'), headerCell('Punishment')] }),
            new TableRow({
              children: [dataCell('302'), dataCell('Murder'), dataCell('Death or imprisonment for life, and liable to fine')],
            }),
            new TableRow({
              children: [
                dataCell('304, Part I'),
                dataCell('Culpable homicide (with intention to cause death)'),
                dataCell('Imprisonment for life, or up to 10 years, plus fine'),
              ],
            }),
            new TableRow({
              children: [
                dataCell('304, Part II'),
                dataCell('Culpable homicide (with knowledge but no intention)'),
                dataCell('Imprisonment up to 10 years, or fine, or both'),
              ],
            }),
          ],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outFile, buffer);
  console.log(`Wrote ${outFile}`);
});
