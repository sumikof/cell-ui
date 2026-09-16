import { describe, it, expect } from 'vitest';
import { parseHtmlTable, serializeHtml, parseDeclarations, parseBorder, normalizeColor, styleToCss } from '../src/clipboard/html';

const EXCEL_HTML = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta name=ProgId content=Excel.Sheet>
<style>
<!--table {mso-displayed-decimal-separator:"\\.";}
td {padding-top:1px;padding-right:1px;padding-left:1px;mso-ignore:padding;color:black;font-size:11.0pt;font-weight:400;font-style:normal;text-decoration:none;font-family:Calibri, sans-serif;text-align:general;vertical-align:bottom;border:none;white-space:nowrap;}
.xl65 {color:red;font-weight:700;font-family:Arial, sans-serif;text-align:center;background:yellow;mso-pattern:black none;border:.5pt solid windowtext;}
.xl66 {font-style:italic;text-decoration:underline;border-top:1.0pt solid windowtext;border-right:none;border-bottom:none;border-left:none;mso-number-format:"0\\.00";white-space:normal;}
-->
</style></head>
<body link="#0563C1" vlink="#954F72">
<table border=0 cellpadding=0 cellspacing=0 width=128 style='border-collapse:collapse;width:96pt'>
<col width=64 span=2 style='width:48pt'>
<tr height=20 style='height:15.0pt'>
  <td height=20 class=xl65 width=64 style='height:15.0pt;width:48pt'>Head</td>
  <td class=xl66 width=64 style='width:48pt' align=right x:num>1,234.5</td>
</tr>
<tr height=20>
  <td height=20 x:num="0.5">50%</td>
  <td>line1<br>line2</td>
</tr>
</table>
</body></html>`;

describe('HTML clipboard format', () => {
  it('parses Excel-generated HTML with class styles', () => {
    const parsed = parseHtmlTable(EXCEL_HTML)!;
    expect(parsed).not.toBeNull();
    expect(parsed.cells.length).toBe(2);
    const head = parsed.cells[0][0];
    expect(head.value).toBe('Head');
    expect(head.style).toMatchObject({
      color: '#ff0000',
      bold: true,
      fontFamily: 'Arial, sans-serif',
      hAlign: 'center',
      backgroundColor: '#ffff00',
      fontSize: 11,
      vAlign: 'bottom',
      wrap: false,
    });
    expect(head.style?.borderTop).toEqual({ style: 'thin', color: '#000000' });
    expect(head.style?.borderLeft).toEqual({ style: 'thin', color: '#000000' });

    const num = parsed.cells[0][1];
    expect(num.value).toBe(1234.5);
    expect(num.style).toMatchObject({ italic: true, underline: true, hAlign: 'right', numberFormat: '0.00', wrap: true });
    expect(num.style?.borderTop).toEqual({ style: 'medium', color: '#000000' });
    expect(num.style?.borderBottom).toBeUndefined();

    expect(parsed.cells[1][0].value).toBe(0.5);
    expect(parsed.cells[1][1].value).toBe('line1\nline2');
    expect(parsed.columnWidths).toEqual([64, 64]);
    expect(parsed.rowHeights?.[0]).toBe(20);
  });

  it('parses generic browser tables with inline formatting', () => {
    const html = `<table><tr><th>Name</th><td style="background-color: rgb(0, 128, 0); color:#fff"><b>Bob</b></td></tr>
      <tr><td colspan="2"><i>merged</i></td></tr><tr><td>TRUE</td><td><font color="#0000ff">x</font></td></tr></table>`;
    const parsed = parseHtmlTable(html)!;
    expect(parsed.cells[0][0]).toEqual({ value: 'Name', style: { bold: true } });
    expect(parsed.cells[0][1]).toEqual({ value: 'Bob', style: { backgroundColor: '#008000', color: '#ffffff', bold: true } });
    expect(parsed.cells[1][0]).toEqual({ value: 'merged', style: { italic: true } });
    expect(parsed.cells[1][1]).toEqual({ value: null });
    expect(parsed.cells[2][0].value).toBe(true);
    expect(parsed.cells[2][1]).toEqual({ value: 'x', style: { color: '#0000ff' } });
  });

  it('returns null without a table', () => {
    expect(parseHtmlTable('<p>hello</p>')).toBeNull();
  });

  it('serialises cells to an Excel-friendly table and round-trips', () => {
    const html = serializeHtml(
      [
        [
          { value: 'Title', style: { bold: true, italic: true, underline: true, strikethrough: true, color: '#ff0000', backgroundColor: '#ffff00', hAlign: 'center', vAlign: 'middle', fontFamily: 'Arial', fontSize: 14, wrap: true } },
          { value: 12.5, style: { borderBottom: { style: 'thick', color: '#0000ff' }, numberFormat: '0.0' } },
        ],
        [{ value: 'a<b>&"c"' }, { value: 'x\ny' }],
      ],
      { columnWidths: [100, 50] },
    );
    expect(html).toContain('<table');
    expect(html).toContain('x:num="12.5"');
    expect(html).toContain('mso-number-format:&quot;0.0&quot;');
    expect(html).toContain('a&lt;b&gt;&amp;&quot;c&quot;');
    expect(html).toContain('x<br>y');
    expect(html).toContain('<col width="100"');
    const parsed = parseHtmlTable(html)!;
    expect(parsed.cells[0][0]).toEqual({
      value: 'Title',
      style: { bold: true, italic: true, underline: true, strikethrough: true, color: '#ff0000', backgroundColor: '#ffff00', hAlign: 'center', vAlign: 'middle', fontFamily: 'Arial', fontSize: 14, wrap: true },
    });
    expect(parsed.cells[0][1].value).toBe(12.5);
    expect(parsed.cells[0][1].style?.borderBottom).toEqual({ style: 'thick', color: '#0000ff' });
    expect(parsed.cells[0][1].style?.numberFormat).toBe('0.0');
    expect(parsed.cells[1][0].value).toBe('a<b>&"c"');
    expect(parsed.cells[1][1].value).toBe('x\ny');
  });

  it('parses declarations with quoted values and borders', () => {
    expect(parseDeclarations('color:red; mso-number-format:"0\\.00;[Red]"; font-weight:700')).toEqual({
      color: 'red',
      'mso-number-format': '"0\\.00;[Red]"',
      'font-weight': '700',
    });
    expect(parseBorder('.5pt solid windowtext')).toEqual({ style: 'thin', color: '#000000' });
    expect(parseBorder('1.5pt dashed #ff0000')).toEqual({ style: 'dashed', color: '#ff0000' });
    expect(parseBorder('2px solid rgb(0,0,255)')).toEqual({ style: 'thick', color: '#0000ff' });
    expect(parseBorder('none')).toBeNull();
    expect(parseBorder(undefined)).toBeUndefined();
    expect(normalizeColor('#FFF')).toBe('#ffffff');
    expect(normalizeColor('rgba(1,2,3,0)')).toBeUndefined();
    expect(normalizeColor('transparent')).toBeUndefined();
  });

  it('emits CSS for the renderer without number format', () => {
    expect(styleToCss({ bold: true, numberFormat: '0' })).toBe('font-weight:bold');
    expect(styleToCss({ bold: true, numberFormat: '0' }, { forClipboard: true })).toContain('mso-number-format');
  });
});
