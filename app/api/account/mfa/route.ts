import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '../../../../lib/db';
import {activeSession,checkPassword} from '../../../../lib/auth';
import {consumeMfaCode,createRecoveryCodes,decryptSecret,encryptSecret,generateMfaSecret,hashRecovery,otpAuthUrl,verifyTotp} from '../../../../lib/mfa';
import {requireSameOrigin,requireJson,readBoundedJson,inputError,limitResponse} from '../../../../lib/http-security';
import {takeRateLimit} from '../../../../lib/rate-limit';
import {auditEntry} from '../../../../lib/audit';

export const dynamic='force-dynamic';
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('start'),password:z.string().min(1).max(128)}).strict(),
  z.object({action:z.literal('confirm'),code:z.string().regex(/^\d{6}$/)}).strict(),
  z.object({action:z.literal('disable'),password:z.string().min(1).max(128),code:z.string().min(6).max(35)}).strict()
]);
export async function GET(){
  const session=await activeSession();
  if(!session)return NextResponse.json({error:'Требуется вход'},{status:401});
  const [user,remaining]=await Promise.all([
    db.user.findUnique({where:{id:session.userId},select:{mfaEnabledAt:true,mfaPendingUntil:true}}),
    db.mfaRecoveryCode.count({where:{userId:session.userId}})
  ]);
  return NextResponse.json({enabled:Boolean(user?.mfaEnabledAt),
    pending:Boolean(user?.mfaPendingUntil&&user.mfaPendingUntil>new Date()),
    recoveryRemaining:remaining},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
  const denied=requireSameOrigin(request)||requireJson(request);if(denied)return denied;
  const session=await activeSession();
  if(!session)return NextResponse.json({error:'Требуется вход'},{status:401});
  const limited=limitResponse(await takeRateLimit('mfa-action',session.userId,12,3600));
  if(limited)return limited;
  try{
    const body=schema.parse(await readBoundedJson(request,2048));
    const user=await db.user.findUnique({where:{id:session.userId}});
    if(!user)return NextResponse.json({error:'Пользователь не найден'},{status:401});
    if(body.action==='start'){
      if(user.mfaEnabledAt)return NextResponse.json({error:'MFA уже включена'},{status:409});
      if(!checkPassword(body.password,user.passwordHash))return NextResponse.json({error:'Неверный пароль'},{status:401});
      const secret=generateMfaSecret();
      await db.user.update({where:{id:user.id},data:{
        mfaPendingCiphertext:encryptSecret(secret),mfaPendingUntil:new Date(Date.now()+600000)
      }});
      return NextResponse.json({secret,uri:otpAuthUrl(user.email,secret)},{
        headers:{'Cache-Control':'no-store'}
      });
    }
    if(body.action==='confirm'){
      if(user.mfaEnabledAt||!user.mfaPendingCiphertext||
        !user.mfaPendingUntil||user.mfaPendingUntil<=new Date())
        return NextResponse.json({error:'Настройка истекла или уже завершена'},{status:409});
      const step=verifyTotp(decryptSecret(user.mfaPendingCiphertext),body.code);
      if(step===null)return NextResponse.json({error:'Неверный код'},{status:401});
      const codes=createRecoveryCodes();
      const enabled=await db.$transaction(async tx=>{
        const updated=await tx.user.updateMany({where:{
          id:user.id,mfaEnabledAt:null,mfaPendingCiphertext:user.mfaPendingCiphertext,
          mfaPendingUntil:{gt:new Date()}
        },data:{
          mfaEnabledAt:new Date(),mfaSecretCiphertext:user.mfaPendingCiphertext,
          mfaPendingCiphertext:null,mfaPendingUntil:null,mfaLastUsedStep:step
        }});
        if(updated.count!==1)return false;
        await tx.mfaRecoveryCode.createMany({data:codes.map(code=>({
          userId:user.id,codeHash:hashRecovery(code)
        }))});
        await tx.session.updateMany({where:{
          userId:user.id,id:{not:session.id},revokedAt:null
        },data:{revokedAt:new Date()}});
        await tx.auditLog.create({data:auditEntry({
          actorId:user.id,action:'account.mfa.enable',targetType:'user',targetId:user.id
        })});
        return true;
      });
      if(!enabled)return NextResponse.json({error:'Настройка изменилась'},{status:409});
      return NextResponse.json({ok:true,recoveryCodes:codes},{headers:{'Cache-Control':'no-store'}});
    }
    if(!user.mfaEnabledAt)return NextResponse.json({error:'MFA ещё не включена'},{status:409});
    if(process.env.ENFORCE_STAFF_MFA==='true'&&user.role!=='CUSTOMER')
      return NextResponse.json({error:'Сотрудник не может отключить обязательную MFA'},{status:409});
    if(!checkPassword(body.password,user.passwordHash))
      return NextResponse.json({error:'Неверный пароль'},{status:401});
    if(!(await consumeMfaCode(user.id,body.code)))
      return NextResponse.json({error:'Неверный или использованный код'},{status:401});
    await db.$transaction(async tx=>{
      await tx.mfaRecoveryCode.deleteMany({where:{userId:user.id}});
      await tx.user.update({where:{id:user.id},data:{
        mfaEnabledAt:null,mfaSecretCiphertext:null,mfaPendingCiphertext:null,
        mfaPendingUntil:null,mfaLastUsedStep:null
      }});
      await tx.session.updateMany({where:{userId:user.id,id:{not:session.id},revokedAt:null},
        data:{revokedAt:new Date()}});
      await tx.auditLog.create({data:auditEntry({
        actorId:user.id,action:'account.mfa.disable',targetType:'user',targetId:user.id
      })});
    });
    return NextResponse.json({ok:true});
  }catch(e){return inputError(e);}
}
