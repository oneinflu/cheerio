const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REPORT_FILE = path.join(__dirname, 'template_send_report_final.csv');
const QA_RESULTS_FILE = path.join(__dirname, 'template_qa_results.csv');
const OUTPUT_FILE = path.join(__dirname, 'template_send_skipped_57.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// Function to escape fields for CSV output
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

async function processSkipped() {
  const skippedNames = new Set();
  
  // 1. Read the report to find skipped templates
  console.log('Reading report file...');
  const reportStream = fs.createReadStream(REPORT_FILE);
  const reportRl = readline.createInterface({ input: reportStream, crlfDelay: Infinity });

  let reportHeader = null;
  let nameIndex = -1;
  let resultIndex = -1;

  for await (const line of reportRl) {
    const cols = parseCsvLine(line);
    if (!reportHeader) {
      reportHeader = cols;
      nameIndex = cols.findIndex(c => c === 'TemplateName');
      resultIndex = cols.findIndex(c => c === 'Result');
      if (nameIndex === -1 || resultIndex === -1) {
        throw new Error('Could not find TemplateName or Result column in report file');
      }
      continue;
    }
    
    const result = cols[resultIndex];
    if (result === 'SKIPPED' || result === 'FAILED') {
      skippedNames.add(cols[nameIndex]);
    }
  }

  console.log(`Found ${skippedNames.size} skipped/failed templates.`);

  if (skippedNames.size === 0) {
    console.log('No skipped templates found. Exiting.');
    return;
  }

  // 2. Read the original QA results to get full details for these templates
  console.log('Reading QA results file...');
  const qaStream = fs.createReadStream(QA_RESULTS_FILE);
  const qaRl = readline.createInterface({ input: qaStream, crlfDelay: Infinity });

  let qaHeader = null;
  let qaNameIndex = -1;
  const skippedRows = [];

  for await (const line of qaRl) {
    const cols = parseCsvLine(line);
    if (!qaHeader) {
      qaHeader = cols;
      qaNameIndex = cols.findIndex(c => c === 'TemplateName');
      if (qaNameIndex === -1) {
        throw new Error('Could not find TemplateName column in QA results file');
      }
      continue;
    }

    if (skippedNames.has(cols[qaNameIndex])) {
      skippedRows.push(cols);
    }
  }

  console.log(`Matched ${skippedRows.length} templates with full details.`);

  // 3. Write to new CSV
  const writeStream = fs.createWriteStream(OUTPUT_FILE);
  
  // Write header
  writeStream.write(qaHeader.map(escapeCsvField).join(',') + '\n');

  // Write rows
  for (const row of skippedRows) {
    writeStream.write(row.map(escapeCsvField).join(',') + '\n');
  }

  writeStream.end();
  console.log(`Written skipped templates to ${OUTPUT_FILE}`);
}

processSkipped().catch(console.error);
