import { NextResponse, NextRequest } from "next/server";
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import {
  corsHeaders, getCookieForRequest,
  validatePromptLength, validateOptionalLength,
  MAX_LYRICS_LENGTH, MAX_TAGS_LENGTH, MAX_TITLE_LENGTH,
} from "@/lib/utils";

export const maxDuration = 60; // allow longer timeout for wait_audio == true
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { prompt, tags, title, make_instrumental, model, wait_audio, negative_tags } = body;

      // Validate size of all user-supplied text fields. `prompt` here is
      // custom-mode lyrics (Suno UI caps at 5000); `tags`, `title`,
      // `negative_tags` are optional shorter strings.
      const err =
        validatePromptLength(prompt, MAX_LYRICS_LENGTH, 'prompt') ??
        validateOptionalLength(tags,          MAX_TAGS_LENGTH,  'tags') ??
        validateOptionalLength(negative_tags, MAX_TAGS_LENGTH,  'negative_tags') ??
        validateOptionalLength(title,         MAX_TITLE_LENGTH, 'title');
      if (err) {
        return new NextResponse(JSON.stringify({ error: err }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const cookie = getCookieForRequest(req);
      if (!cookie) {
        return new NextResponse(JSON.stringify({ error: 'Missing Suno cookie — send your cookie as the X-Suno-Cookie header.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      const audioInfo = await (await sunoApi(cookie)).custom_generate(
        prompt, tags, title,
        Boolean(make_instrumental),
        model || DEFAULT_MODEL,
        Boolean(wait_audio),
        negative_tags
      );
      return new NextResponse(JSON.stringify(audioInfo), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error: any) {
      console.error('Error generating custom audio:', error);
      return new NextResponse(JSON.stringify({ error: error.response?.data?.detail || error.toString() }), {
        status: error.response?.status || 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'POST',
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
