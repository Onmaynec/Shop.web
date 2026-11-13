import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { hashPassword,setSession } from '../../../../lib/auth';
const schema=z.object({email:z.string().trim().email().max(254),password:z.string().min(12).max(128)});
export async function POST(req:Request){try{const {email,password}=schema.parse(await req.json());const user=await db.user.create({data:{email:email.toLowerCase(),passwordHash:hashPassword(password)}});await setSession(user.id);return NextResponse.json({user:{id:user.id,email:user.email}},{status:201});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'Email already registered'},{status:409});if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'Invalid email or password (minimum 12 characters)'},{status:400});console.error('Registration failed',e);return NextResponse.json({error:'Internal error'},{status:500});}}
