import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '../../../../lib/db';
import {currentUser} from '../../../../lib/auth';
import {adminGate,readAdminBody,adminApiError} from '../../../../lib/admin-api';
import {auditEntry} from '../../../../lib/audit';

const input=z.object({
  userId:z.string().cuid(),
  role:z.enum(['CUSTOMER','SUPPORT','FULFILLMENT','ADMIN'])
}).strict();

class RoleConflict extends Error {}

export async function PATCH(request:Request){
  const denied=await adminGate(request,true);
  if(denied)return denied;
  try{
    const actor=await currentUser();
    if(!actor)return NextResponse.json({error:'Недостаточно прав'},{status:403});
    const data=input.parse(await readAdminBody(request));
    if(data.userId===actor.id){
      return NextResponse.json({error:'Нельзя менять роль собственного аккаунта через этот интерфейс'},{status:409});
    }
    const result=await db.$transaction(async tx=>{
      // Serialize role changes and re-check the actor after acquiring the lock.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(4819022026)`;
      const existingActor=await tx.user.findUnique({where:{id:actor.id},select:{role:true}});
      if(existingActor?.role!=='ADMIN')throw new RoleConflict('Права администратора изменились');
      const target=await tx.user.findUnique({
        where:{id:data.userId},select:{id:true,role:true}
      });
      if(!target)throw new RoleConflict('Пользователь не найден');
      if(target.role==='ADMIN'&&data.role!=='ADMIN'){
        const admins=await tx.user.count({where:{role:'ADMIN'}});
        if(admins<=1)throw new RoleConflict('Нельзя снять права у последнего администратора');
      }
      if(target.role===data.role)return {changed:false,role:data.role};
      await tx.user.update({where:{id:target.id},data:{role:data.role}});
      // A role change invalidates every existing login. Re-authentication is required.
      await tx.session.updateMany({
        where:{userId:target.id,revokedAt:null},data:{revokedAt:new Date()}
      });
      if(data.role!=='SUPPORT'&&data.role!=='ADMIN'){
        await tx.supportTicket.updateMany({
          where:{assignedToId:target.id},data:{assignedToId:null}
        });
      }
      if(data.role!=='FULFILLMENT'&&data.role!=='ADMIN'){
        await tx.orderTask.updateMany({
          where:{assignedToId:target.id},data:{assignedToId:null}
        });
      }
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'staff.role.change',targetType:'user',targetId:target.id,
        details:{from:target.role,to:data.role,sessionsRevoked:true}
      })});
      return {changed:true,role:data.role};
    },{timeout:15000});
    return NextResponse.json({ok:true,...result});
  }catch(e){
    if(e instanceof RoleConflict)return NextResponse.json({error:e.message},{status:409});
    return adminApiError(e);
  }
}
