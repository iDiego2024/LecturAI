import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDemoEmail } from '@/lib/demo';
import { importExternalResource } from '@/lib/external-sources/services/import-external-resource';
import { isSourceKey } from '@/lib/external-sources/types';
import type { SourceKey } from '@/lib/external-sources/types';
import { ExternalSourceError } from '@/lib/external-sources/adapters/base';

type ImportRequestBody = {
  source?: SourceKey;
  externalId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (isDemoEmail(user.email)) {
      return NextResponse.json(
        { error: 'El modo demo no permite importar recursos externos.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ImportRequestBody;
    if (!isSourceKey(body.source) || typeof body.externalId !== 'string' || !body.externalId.trim()) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }

    const result = await importExternalResource({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: (user.user_metadata as Record<string, unknown> | null) || null,
      },
      source: body.source,
      externalId: body.externalId.trim(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('book_sources.import error', error);

    if (error instanceof ExternalSourceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible importar este recurso en este momento.',
      },
      { status: 500 }
    );
  }
}
