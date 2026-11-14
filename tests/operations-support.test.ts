import {describe,it,expect} from 'vitest';
import {hasPermission,isStaff,staffLanding} from '../lib/permissions';
import {csvCell,csvRows,parseUtcDay} from '../lib/csv';
import {ticketCreate,ticketReply,ticketManage} from '../lib/support-schemas';

describe('v0.9.0-pre.1 roles and support',()=>{
  it('grants least privilege and keeps owner-only actions restricted',()=>{
    expect(hasPermission('ADMIN','admin')).toBe(true);
    expect(hasPermission('ADMIN','support')).toBe(true);
    expect(hasPermission('SUPPORT','support')).toBe(true);
    expect(hasPermission('SUPPORT','admin')).toBe(false);
    expect(hasPermission('FULFILLMENT','fulfillment')).toBe(true);
    expect(hasPermission('FULFILLMENT','support')).toBe(false);
    expect(hasPermission('CUSTOMER','support')).toBe(false);
    expect(isStaff('CUSTOMER')).toBe(false);
    expect(staffLanding('SUPPORT')).toBe('/admin/support');
  });
  it('validates tickets and disallows untrusted extra input',()=>{
    expect(ticketCreate.safeParse({subject:'Вопрос по заказу',
      message:'Подскажите, когда будет готово?',orderId:null}).success).toBe(true);
    expect(ticketCreate.safeParse({subject:'a',message:'short'}).success).toBe(false);
    expect(ticketCreate.safeParse({subject:'Вопрос по заказу',
      message:'Подскажите, когда будет готово?',customerId:'someone-else'}).success).toBe(false);
    expect(ticketReply.safeParse({message:'Ответ',internal:false}).success).toBe(true);
    expect(ticketReply.safeParse({message:'',internal:true}).success).toBe(false);
    expect(ticketManage.safeParse({}).success).toBe(false);
    expect(ticketManage.safeParse({status:'CLOSED',priority:'HIGH'}).success).toBe(true);
  });
  it('neutralizes formula injection in CSV even with prefix spaces',()=>{
    for(const raw of ['=1+1','+SUM(1,2)','-CMD','@cmd','\t=1+1','\n+1']){
      const safe=csvCell(raw);
      expect(safe).toMatch(/^"'|^"' /);
      expect(safe).not.toBe('"'+raw+'"');
    }
    expect(csvCell('value"hello')).toBe('"value""hello"');
    expect(csvRows([['name','email'],['test','=1+1']])).toContain('"\'=1+1"');
  });
  it('rejects malformed and impossible dates',()=>{
    expect(parseUtcDay('2026-11-14')?.toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect(parseUtcDay('2026-02-30')).toBeNull();
    expect(parseUtcDay('2026-11-14x')).toBeNull();
  });
});
