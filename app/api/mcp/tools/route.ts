import { NextRequest, NextResponse } from 'next/server';
import { getMCPGateway } from '@/lib/mcp-gateway';

export async function GET(request: NextRequest) {
  const gateway = getMCPGateway();
  const { searchParams } = request.nextUrl;
  const server = searchParams.get('server') || undefined;
  const tools = gateway.listTools(server);
  return NextResponse.json(tools);
}
