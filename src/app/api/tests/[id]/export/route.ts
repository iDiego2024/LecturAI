import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWordDocument } from '@/lib/export/docx';
import { isDemoEmail } from '@/lib/demo';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version') || 'student'; // 'student' or 'teacher'
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isDemoEmail(user.email)) {
      return NextResponse.json(
        { error: 'La cuenta demo no permite descargar evaluaciones.' },
        { status: 403 }
      );
    }

    // Generate document only for tests owned by authenticated user
    const { buffer, title } = await generateWordDocument({
      testId: params.id,
      isTeacherVersion: version === 'teacher',
      userId: user.id,
    });

    const filename = `${title || 'Prueba'}_${version === 'teacher' ? 'Docente' : 'Alumno'}.docx`.replace(/\s+/g, '_');

    // Return as downloadable file
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
