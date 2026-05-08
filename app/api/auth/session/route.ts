import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth/actions";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      subsidiary: user.subsidiary,
      company: user.company,
      avatar_url: user.avatar_url,
    },
  });
}
