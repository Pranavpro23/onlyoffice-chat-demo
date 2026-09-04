const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const outDir = path.join(__dirname, '..', 'storage');
const outFile = path.join(outDir, 'starter.pptx');

fs.mkdirSync(outDir, { recursive: true });

const pptx = new pptxgen();

const NAVY = '1F1F3D';
const SUBTITLE_GRAY = '5A5A7A';
const BODY_GRAY = '333333';

// Title-slide layout: centered title + subtitle placeholders.
pptx.defineSlideMaster({
  title: 'TITLE_SLIDE_MASTER',
  background: { color: 'FFFFFF' },
  objects: [
    {
      placeholder: {
        options: { name: 'title', type: 'title', x: 0.5, y: 2.2, w: 9, h: 1.3, fontSize: 40, bold: true, align: 'center', color: NAVY },
        text: '',
      },
    },
    {
      placeholder: {
        options: { name: 'body', type: 'body', x: 0.5, y: 3.6, w: 9, h: 1, fontSize: 20, align: 'center', color: SUBTITLE_GRAY },
        text: '',
      },
    },
  ],
});

// Title-and-content layout: title placeholder + body placeholder used for
// bulleted text on slides 2-3, and left bare (only title filled) on slide 4
// so a table can be added into the same content area.
pptx.defineSlideMaster({
  title: 'TITLE_AND_BODY_MASTER',
  background: { color: 'FFFFFF' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9, h: 1.0, fontSize: 30, bold: true, color: NAVY }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.5, y: 1.5, w: 9, h: 5.2, fontSize: 18, color: BODY_GRAY }, text: '' } },
  ],
});

// Slide 1: title slide
const slide1 = pptx.addSlide({ masterName: 'TITLE_SLIDE_MASTER' });
slide1.addText('Murder Under Indian Law', { placeholder: 'title' });
slide1.addText('Distinguishing Culpable Homicide from Murder — IPC Sections 299–304', { placeholder: 'body' });

// Slide 2: Defining the Offence
const slide2 = pptx.addSlide({ masterName: 'TITLE_AND_BODY_MASTER' });
slide2.addText('Defining the Offence', { placeholder: 'title' });
slide2.addText(
  [
    { text: 'Section 299: Culpable homicide — causing death with intention, or with knowledge that the act is likely to cause death', options: { bullet: true, breakLine: true, paraSpaceAfter: 12 } },
    { text: 'Section 300: Murder — culpable homicide becomes murder when one of four specific aggravating conditions is met', options: { bullet: true, breakLine: true, paraSpaceAfter: 12 } },
    { text: 'The core distinction is the degree of intention and the probability of death, not the act itself', options: { bullet: true } },
  ],
  { placeholder: 'body' }
);

// Slide 3: Exceptions to Murder
const slide3 = pptx.addSlide({ masterName: 'TITLE_AND_BODY_MASTER' });
slide3.addText('Exceptions to Murder', { placeholder: 'title' });
slide3.addText(
  [
    { text: 'Exception 1: Grave and sudden provocation', options: { bullet: true, breakLine: true, paraSpaceAfter: 12 } },
    { text: 'Exception 4: A sudden fight, without premeditation, with no undue advantage taken and no cruel or unusual manner', options: { bullet: true, breakLine: true, paraSpaceAfter: 12 } },
    { text: 'Effect: these exceptions reduce the offence from murder to culpable homicide not amounting to murder, under Section 304', options: { bullet: true } },
  ],
  { placeholder: 'body' }
);

// Slide 4: Punishment Framework
const slide4 = pptx.addSlide({ masterName: 'TITLE_AND_BODY_MASTER' });
slide4.addText('Punishment Framework', { placeholder: 'title' });
slide4.addTable(
  [
    [
      { text: 'Section', options: { bold: true, color: 'FFFFFF', fill: { color: NAVY } } },
      { text: 'Offence', options: { bold: true, color: 'FFFFFF', fill: { color: NAVY } } },
      { text: 'Punishment', options: { bold: true, color: 'FFFFFF', fill: { color: NAVY } } },
    ],
    ['302', 'Murder', 'Death or imprisonment for life, and liable to fine'],
    ['304, Part I', 'Culpable homicide (with intention to cause death)', 'Imprisonment for life, or up to 10 years, plus fine'],
    ['304, Part II', 'Culpable homicide (with knowledge but no intention)', 'Imprisonment up to 10 years, or fine, or both'],
  ],
  { x: 0.5, y: 1.6, w: 9, colW: [1.3, 3.7, 4.0], fontSize: 12, valign: 'middle', border: { type: 'solid', color: 'CCCCCC', pt: 1 } }
);

pptx.writeFile({ fileName: outFile }).then(() => {
  console.log(`Wrote ${outFile}`);
});
