import type { UserRole } from '@prisma/client';

export type Permission='admin'|'support'|'fulfillment';
export function hasPermission(role:UserRole,permission:Permission){
  return role==='ADMIN'
    ||(permission==='support'&&role==='SUPPORT')
    ||(permission==='fulfillment'&&role==='FULFILLMENT');
}
export function isStaff(role:UserRole){
  return hasPermission(role,'admin')||hasPermission(role,'support')||hasPermission(role,'fulfillment');
}
export function staffLanding(role:UserRole){
  if(role==='SUPPORT')return '/admin/support';
  if(role==='FULFILLMENT')return '/admin/queue';
  return '/admin';
}
