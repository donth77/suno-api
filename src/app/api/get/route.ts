import { NextResponse, NextRequest } from 'next/server';
import { sunoApi } from '@/lib/SunoApi';
import { corsHeaders, getCookieForRequest } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const songIds = url.searchParams.get('ids');
      const page = url.searchParams.get('page');
      const cookie = getCookieForRequest(req);
      if (!cookie) {
        return new NextResponse(JSON.stringify({ error: 'Missing Suno cookie — send your cookie as the X-Suno-Cookie header.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      let audioInfo = [];
      if (songIds && songIds.length > 0) {
        const idsArray = songIds.split(',');
        audioInfo = await (await sunoApi(cookie)).get(idsArray, page);
      } else {
        audioInfo = await (await sunoApi(cookie)).get(undefined, page);
      }

      return new NextResponse(JSON.stringify(audioInfo), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error fetching audio:', error);

      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'GET',
        ...corsHeaders
      },
      status: 405
    });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}
