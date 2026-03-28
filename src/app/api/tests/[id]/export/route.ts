import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWordDocument } from '@/lib/export/docx';

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

    // Generate Document buffer
    const buffer = await generateWordDocument({
      testId: params.id,
      isTeacherVersion: version === 'teacher'
    });

    // Determine filename
    const { data: test } = await supabase
      .from('tests')
      .select('title')
      .eq('id', params.id)
      .single();
      
    const filename = `${test?.title || 'Prueba'}_${version === 'teacher' ? 'Docente' : 'Alumno'}.docx`.replace(/\s+/g, '_');

    // Return as downloadable file
    return new NextResponse(buffer, {
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
