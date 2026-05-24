export { getHeaders, convertCsvToArray };

const delimiters = [',', ';', '\t', '|'];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  const delimiterScores = delimiters.map(delimiter => ({
    delimiter,
    score: lines.reduce((total, line) => total + countDelimiterOutsideQuotes(line, delimiter), 0),
  }));

  return delimiterScores.sort((a, b) => b.score - a.score)[0]?.delimiter || ',';
}

function getHeaders(csv: string, delimiter: string): string[] {
  if (csv.trim() === '') {
    return [];
  }

  const firstLine = csv.split('\n')[0];
  return firstLine.split(new RegExp(escapeRegExp(delimiter))).map(header => header.trim());
}
function deserializeValue(value: string, tryParseValues: boolean): unknown {
  if (value === 'null') {
    return null;
  }

  if (value === '' || typeof value === 'undefined') {
    return undefined;
  }

  const valueAsString = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');

  if (valueAsString.startsWith('"') && valueAsString.endsWith('"')) {
    return valueAsString.slice(1, -1);
  }

  if (!tryParseValues) {
    return valueAsString;
  }
  try {
    return JSON.parse(valueAsString);
  }
  catch (_) {
    return valueAsString;
  }
}

function convertCsvToArray(csv: string, tryParseValues: boolean = false): Record<string, unknown>[] {
  const delimiter = detectDelimiter(csv);
  const headers = getHeaders(csv, delimiter);
  const delimiterRegexp = new RegExp(`${escapeRegExp(delimiter)}(?=(?:(?:[^"]*"){2})*[^"]*$)`);

  return csv
    .split('\n')
    .slice(1)
    .map((line) => {
      // Split on the detected delimiter when it is not within quotes.
      const data = line.split(delimiterRegexp).map(value => value.trim());
      return headers.reduce(
        (obj, header, index) => {
          obj[header] = deserializeValue(data[index], tryParseValues);
          return obj;
        },
        {} as Record<string, unknown>,
      );
    });
}
