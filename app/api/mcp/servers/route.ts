import { NextResponse } from 'next/server';
import { getMCPGateway } from '@/lib/mcp-gateway';

export async function GET() {
  const gateway = getMCPGateway();
  const servers = gateway.listServers();
  return NextResponse.json(servers);
}
