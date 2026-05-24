import { js2xml } from 'xml-js';
import YAML from 'yaml';

export type ExportFormat = 'json' | 'yaml' | 'sql' | 'csv' | 'csv_semicolon' | 'tsv' | 'markdown' | 'xml' | 'xlsx';

interface ExportOptions {
  tableName?: string
  nestify?: boolean
}

function getHeaders(array: Record<string, unknown>[]) {
  const headers = new Set<string>();

  array.forEach(item => Object.keys(item).forEach(header => headers.add(header)));

  return Array.from(headers);
}

function serializeDelimitedValue(value: unknown, delimiter: string) {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return '';
  }

  const valueAsString = String(value);

  if (valueAsString.includes(delimiter) || valueAsString.includes('\n') || valueAsString.includes('\r') || valueAsString.includes('"')) {
    return `"${valueAsString.replace(/"/g, '""')}"`;
  }

  return valueAsString;
}

function toDelimited(array: Record<string, unknown>[], delimiter: string) {
  const headers = getHeaders(array);
  const rows = array.map(item => headers.map(header => serializeDelimitedValue(item[header], delimiter)).join(delimiter));

  return [headers.join(delimiter), ...rows].join('\n');
}

function toMarkdown(array: Record<string, unknown>[]) {
  const headers = getHeaders(array);
  const rows = array.map(item => `| ${headers.map(header => String(item[header] ?? '')).join(' | ')} |`);

  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows,
  ].join('\n');
}

function toSql(array: Record<string, unknown>[], tableName: string) {
  const headers = getHeaders(array);

  return array.map((item) => {
    const columns = headers.map(header => `"${header.replace(/"/g, '""')}"`).join(', ');
    const values = headers.map((header) => {
      const value = item[header];

      if (value === null || value === undefined) {
        return 'NULL';
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      return `'${String(value).replace(/'/g, '\'\'')}'`;
    }).join(', ');

    return `INSERT INTO ${tableName} (${columns}) VALUES (${values});`;
  }).join('\n');
}

function nestObject(input: Record<string, unknown>) {
  return Object.entries(input).reduce((output, [key, value]) => {
    const path = key.split('.');
    let target = output;

    path.forEach((part, index) => {
      if (index === path.length - 1) {
        target[part] = value;
        return;
      }

      if (typeof target[part] !== 'object' || target[part] === null || Array.isArray(target[part])) {
        target[part] = {};
      }

      target = target[part] as Record<string, unknown>;
    });

    return output;
  }, {} as Record<string, unknown>);
}

export function objectArrayToData(array: Record<string, unknown>[], format: ExportFormat, options: ExportOptions = {}) {
  const data = options.nestify ? array.map(nestObject) : array;

  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return YAML.stringify(data);
    case 'sql':
      return toSql(data, options.tableName || 'TableName');
    case 'csv':
      return toDelimited(data, ',');
    case 'csv_semicolon':
      return toDelimited(data, ';');
    case 'tsv':
      return toDelimited(data, '\t');
    case 'markdown':
      return toMarkdown(data);
    case 'xml':
      return js2xml({ rows: { row: data } }, { compact: true, spaces: 2 });
    default:
      return '';
  }
}
