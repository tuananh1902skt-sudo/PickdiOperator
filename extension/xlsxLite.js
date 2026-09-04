// Đọc tối thiểu 1 file .xlsx — chỉ lấy 1 cột theo tên header từ sheet ĐẦU TIÊN, đủ dùng cho
// luồng import handle từ file Kalodata tải về. KHÔNG cần vendor thư viện ngoài (JSZip/SheetJS):
// .xlsx thực chất là 1 file ZIP chứa các entry XML, và mọi entry trong đó luôn nén bằng DEFLATE
// (kiểu nén #8) — Chrome's DecompressionStream('deflate-raw') đã hỗ trợ sẵn kiểu này native,
// nên chỉ cần tự đọc cấu trúc ZIP (End Of Central Directory -> Central Directory -> Local File
// Header) bằng DataView là đủ, không cần parse thuật toán deflate bằng tay.

async function unzipXlsxEntries(arrayBuffer, wantedNames) {
  const bytes = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  // EOCD nằm ở cuối file, sau 1 đoạn comment tuỳ ý (tối đa 65535 byte) — quét ngược từ cuối.
  const scanFrom = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= scanFrom; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('File không đúng định dạng .xlsx (thiếu ZIP End Of Central Directory).');
  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  const cdOffset = dv.getUint32(eocdOffset + 16, true);

  const CD_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;
  const found = {};
  let offset = cdOffset;
  const decoder = new TextDecoder('utf-8');
  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(offset, true) !== CD_SIG) break;
    const compressionMethod = dv.getUint16(offset + 10, true);
    const compressedSize = dv.getUint32(offset + 20, true);
    const nameLen = dv.getUint16(offset + 28, true);
    const extraLen = dv.getUint16(offset + 30, true);
    const commentLen = dv.getUint16(offset + 32, true);
    const localHeaderOffset = dv.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    if (wantedNames.includes(name)) found[name] = { compressionMethod, compressedSize, localHeaderOffset };
    offset += 46 + nameLen + extraLen + commentLen;
  }

  const result = {};
  for (const name of Object.keys(found)) {
    const entry = found[name];
    const lh = entry.localHeaderOffset;
    if (dv.getUint32(lh, true) !== LFH_SIG) continue;
    // Local File Header có thể có tên/extra field khác độ dài so với Central Directory — phải
    // đọc lại đúng độ dài ở CHÍNH local header này để tính đúng offset bắt đầu dữ liệu nén.
    const lNameLen = dv.getUint16(lh + 26, true);
    const lExtraLen = dv.getUint16(lh + 28, true);
    const dataStart = lh + 30 + lNameLen + lExtraLen;
    const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
    let raw;
    if (entry.compressionMethod === 0) {
      raw = compressed;
    } else if (entry.compressionMethod === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      raw = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`File .xlsx dùng kiểu nén ZIP không hỗ trợ (#${entry.compressionMethod}).`);
    }
    result[name] = decoder.decode(raw);
  }
  return result;
}

function colLetterFromCellRef(ref) {
  const m = /^[A-Z]+/.exec(ref || '');
  return m ? m[0] : '';
}

function xlsxCellText(cellEl, sharedStrings) {
  const t = cellEl.getAttribute('t');
  if (t === 'inlineStr') {
    const is = cellEl.getElementsByTagName('is')[0];
    return is ? is.textContent.trim() : '';
  }
  if (t === 's') {
    const v = cellEl.getElementsByTagName('v')[0];
    const idx = v ? parseInt(v.textContent, 10) : NaN;
    return Number.isFinite(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx].trim() : '';
  }
  const v = cellEl.getElementsByTagName('v')[0];
  return v ? v.textContent.trim() : '';
}

// Đọc 1 cột theo tên header (không phân biệt hoa/thường, khớp bất kỳ tên nào trong
// `headerCandidates`) từ sheet ĐẦU TIÊN trong workbook (xl/worksheets/sheet1.xml — đúng cấu trúc
// file Kalodata xuất ra, luôn 1 sheet "Merged Creators"). Trả về mảng giá trị cột đó theo đúng
// thứ tự dòng, đã lọc ô rỗng.
async function readXlsxColumnByHeader(arrayBuffer, headerCandidates) {
  const entries = await unzipXlsxEntries(arrayBuffer, ['xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml']);
  const sheetXml = entries['xl/worksheets/sheet1.xml'];
  if (!sheetXml) throw new Error('Không đọc được sheet đầu tiên trong file .xlsx (thiếu xl/worksheets/sheet1.xml).');

  const sharedStrings = [];
  if (entries['xl/sharedStrings.xml']) {
    const ssDoc = new DOMParser().parseFromString(entries['xl/sharedStrings.xml'], 'application/xml');
    const siList = ssDoc.getElementsByTagName('si');
    for (let i = 0; i < siList.length; i++) sharedStrings.push(siList[i].textContent);
  }

  const doc = new DOMParser().parseFromString(sheetXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Không parse được nội dung XML của sheet trong file .xlsx.');
  }
  const rows = doc.getElementsByTagName('row');
  if (rows.length === 0) return [];

  const headerCells = rows[0].getElementsByTagName('c');
  let targetCol = '';
  const candidates = headerCandidates.map((h) => h.toLowerCase());
  for (let i = 0; i < headerCells.length; i++) {
    const text = xlsxCellText(headerCells[i], sharedStrings).toLowerCase();
    if (candidates.includes(text)) {
      targetCol = colLetterFromCellRef(headerCells[i].getAttribute('r'));
      break;
    }
  }
  if (!targetCol) {
    throw new Error(`Không tìm thấy cột nào tên "${headerCandidates.join('/')}" ở dòng tiêu đề của file.`);
  }

  const values = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r].getElementsByTagName('c');
    for (let i = 0; i < cells.length; i++) {
      if (colLetterFromCellRef(cells[i].getAttribute('r')) === targetCol) {
        const text = xlsxCellText(cells[i], sharedStrings);
        if (text) values.push(text);
        break;
      }
    }
  }
  return values;
}
