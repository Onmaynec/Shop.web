import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { checkPassword, clearSession, setSession } from '../../../../lib/auth';
import { consumeMfaCode } from '../../../../lib/mfa';
import { takeRateLimit } from '../../../../lib/rate-limit';
import { requireSameOrigin, requireJson, readBoundedJson, inputError, ipLimit, limitResponse } from '../../../../lib/http-security';

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  mfaCode: z.string().min(6).max(35).optional()
}).strict();

export async function POST(request: Request) {
  const origin = requireSameOrigin(request) || requireJson(request);
  if (origin) return origin;
  try {
    const input = schema.parse(await readBoundedJson(request));
    const email = input.email.toLowerCase();
    const ipDenied = await ipLimit(request, 'login-ip', 60, 900);
    if (ipDenied) return ipDenied;
    const denied = limitResponse(await takeRateLimit('login-account', email, 10, 900));
    if (denied) return denied;

    const user = await db.user.findUnique({ where: { email } });
    // Avoid revealing whether this account exists through different error messages.
    if (!user || !checkPassword(input.password, user.passwordHash)) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401, headers: {'Cache-Control':'no-store'} });
    }
    if(user.mfaEnabledAt){
      if(!input.mfaCode)return NextResponse.json({
        error:'Для входа нужен код двухфакторной аутентификации',
        mfaRequired:true
      },{status:401,headers:{'Cache-Control':'no-store'}});
      if(!(await consumeMfaCode(user.id,input.mfaCode))){
        return NextResponse.json({error:'Неверный или уже использованный код 2FA',
          mfaRequired:true},{status:401,headers:{'Cache-Control':'no-store'}});
      }
    }
    await clearSession();
    await setSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role }
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return inputError(error);
  }
}
