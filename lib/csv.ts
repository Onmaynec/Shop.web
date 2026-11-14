/** CSV for spreadsheet programs. Never allow untrusted cell contents to become formulas. */
export function csvCell(value:string|number|null|undefined){
  let text=String(value??'').replace(/\u0000/g,'');
  // Excel/LibreOffice will interpret values beginning with =+-@ as formulas,
  // including when preceded by whitespace or control characters.
  if(/^[\s\u0000-\u001f]*[=+@-]/u.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function csvRows(rows:ReadonlyArray<ReadonlyArray<string|number|null|undefined>>){
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
export function parseUtcDay(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const parsed=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?parsed:null;
}
