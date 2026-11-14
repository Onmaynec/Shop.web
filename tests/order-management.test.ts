import { describe,expect,it } from 'vitest';
import { identifyPrivateFile,safeOriginalName } from '../lib/private-assets';
import { statusTitle } from '../lib/order-operations';
import { canAdminTransition } from '../lib/order-workflow';

describe('Order Management 2.0',()=>{
  it('only supports safe deliverable types and known file signatures',()=>{
    const pdf=new TextEncoder().encode('%PDF-1.7 sample');
    const text=new TextEncoder().encode('Демо-отчёт без личных данных');
    expect(identifyPrivateFile(pdf,'application/pdf')?.ext).toBe('pdf');
    expect(identifyPrivateFile(text,'text/plain')?.ext).toBe('txt');
    expect(identifyPrivateFile(text,'application/pdf')).toBeNull();
    expect(identifyPrivateFile(new Uint8Array([0,0,0,0]),'text/plain')).toBeNull();
    expect(identifyPrivateFile(new TextEncoder().encode('<svg/>'),'image/svg+xml')).toBeNull();
  });
  it('sanitizes customer-facing file names',()=>{
    expect(safeOriginalName('../../report.txt')).toBe('report.txt');
    expect(safeOriginalName('..\\secret\\order.pdf')).toBe('order.pdf');
    expect(safeOriginalName('abc\r\nX-Test: yes.txt')).toBe('abcX-Test: yes.txt');
  });
  it('preserves the restricted order status machine',()=>{
    expect(canAdminTransition('PENDING_PAYMENT','PROCESSING')).toBe(false);
    expect(canAdminTransition('PAID','PROCESSING')).toBe(true);
    expect(canAdminTransition('PROCESSING','FULFILLED')).toBe(true);
    expect(canAdminTransition('REFUNDED','FULFILLED')).toBe(false);
    expect(statusTitle('REFUNDED')).toBe('Оплата возвращена');
  });
});
