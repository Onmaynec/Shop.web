import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { checkPassword,setSession } from '../../../../lib/auth';
const schema=z.object({email:z.string().email(),password:z.string()});
export async function POST(req:Request){try{const {email,password}=schema.parse(await req.json());const user=await db.user.findUnique({where:{email:email.toLowerCase()}});if(!user||!checkPassword(password,user.passwordHash))return NextResponse.json({error:'Invalid credentials'},{status:401});await setSession(user.id);return NextResponse.json({user:{id:user.id,email:user.email,role:user.role}});}catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'Invalid request'},{status:400});console.error('Login failed',e);return NextResponse.json({error:'Internal error'},{status:500});}}
