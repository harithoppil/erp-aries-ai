import { errorMessage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { getMCPGateway } from '@/lib/mcp-gateway';

export async function POST(request: NextRequest) {
  try {
    const body: { tool_name?: string; kwargs?: Record<string, unknown> } = await request.json();
    const { tool_name, kwargs } = body;

    if (!tool_name) {
      return NextResponse.json({ error: 'tool_name is required' }, { status: 400 });
    }

    const gateway = getMCPGateway();
    const result = await gateway.callTool(tool_name, kwargs || {});
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Tool call failed') },
      { status: 500 }
    );
  }
}
