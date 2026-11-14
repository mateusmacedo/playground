import { inflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { createZip } from './zip.js';

const CENTRAL_HEADER_SIGNATURE = 0x02014b50;

function readSingleEntry(zip: Buffer) {
  const nameLength = zip.readUInt16LE(26);
  const compressedSize = zip.readUInt32LE(18);
  const dataStart = 30 + nameLength;
  const central = zip.indexOf(
    Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    dataStart + compressedSize,
  );
  return {
    name: zip.subarray(30, dataStart).toString('utf-8'),
    data: inflateRawSync(zip.subarray(dataStart, dataStart + compressedSize)),
    dosDate: zip.readUInt16LE(12),
    centralSignature: zip.readUInt32LE(central),
    externalAttributes: zip.readUInt32LE(central + 38),
    madeBy: zip.readUInt16LE(central + 4),
  };
}

describe('createZip', () => {
  const data = Buffer.from('binário de teste');
  const zip = createZip([{ name: 'bootstrap', data, mode: 0o755 }]);

  it('grava a entrada comprimida com o conteúdo original', () => {
    const entry = readSingleEntry(zip);
    expect(entry.name).toBe('bootstrap');
    expect(entry.data.equals(data)).toBe(true);
    expect(entry.centralSignature).toBe(CENTRAL_HEADER_SIGNATURE);
  });

  it('preserva o bit de execução nos atributos Unix', () => {
    const entry = readSingleEntry(zip);
    expect(entry.madeBy >> 8).toBe(3);
    expect((entry.externalAttributes >>> 16) & 0o777).toBe(0o755);
  });

  it('gera bytes idênticos para a mesma entrada', () => {
    const again = createZip([{ name: 'bootstrap', data, mode: 0o755 }]);
    expect(again.equals(zip)).toBe(true);
    expect(readSingleEntry(zip).dosDate).toBe((1 << 5) | 1);
  });

  it('fecha o arquivo com o diretório central no fim', () => {
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(1);
  });
});
