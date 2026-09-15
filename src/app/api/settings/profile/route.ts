import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(){
  const user = await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({user});
}

export async function PUT(req: NextRequest){
  const user = await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const { name, institute_name } = await req.json();
  const cleanName = String(name||"").trim();
  const cleanInst = String(institute_name||"").trim();
  if (cleanName && cleanName.length < 2) return NextResponse.json({error:"Name too short"},{status:400});
  if (cleanInst && cleanInst.length > 80) return NextResponse.json({error:"Institute name too long (max 80)"},{status:400});
  const db = await getDb();
  const updates: string[] = [];
  const args: any[] = [];
  if (cleanName) { updates.push("name=?"); args.push(cleanName); }
  if (cleanInst) { updates.push("institute_name=?"); args.push(cleanInst); }
  if (cleanInst === "") { updates.push("institute_name=?"); args.push("Momin Academy"); }
  if (updates.length===0) return NextResponse.json({ok:true});
  args.push(user.id);
  await db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id=?`).run(...args);
  return NextResponse.json({ok:true});
}
