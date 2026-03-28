import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx';
import { createClient } from '../supabase/server';

interface ExportConfig {
  testId: string;
  isTeacherVersion: boolean;
}

export async function generateWordDocument({ testId, isTeacherVersion }: ExportConfig) {
  const supabase = createClient();
  
  // 1. Fetch test details
  const { data: test } = await supabase
    .from('tests')
    .select(`
      *,
      books (title, author),
      test_items (
        item_order,
        points,
        question_bank (
          q_type,
          question_text,
          correct_answer,
          distractors,
          rubric,
          justification
        )
      )
    `)
    .eq('id', testId)
    .single();

  if (!test) throw new Error('Test not found');

  // Sort items by order
  const items = test.test_items.sort((a: any, b: any) => a.item_order - b.item_order);

  // 2. Build Document Elements
  const children: any[] = [
    new Paragraph({
      text: test.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      text: `Libro: ${test.books.title} ${test.books.author ? `por ${test.books.author}` : ''}`,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    isTeacherVersion ? new Paragraph({
      children: [
        new TextRun({ text: "VERSIÓN DOCENTE (PAUTA DE CORRECCIÓN)", bold: true, color: "FF0000" })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }) : new Paragraph({ text: "" }),
    
    // Header block for student
    new Paragraph({ text: `Nombre del estudiante: __________________________________________________`, spacing: { after: 200 } }),
    new Paragraph({ text: `Curso: ${test.target_grade || '_________________'}          Fecha: _________________`, spacing: { after: 400 } }),
    
    new Paragraph({
      children: [
        new TextRun({ text: "Instrucciones: ", bold: true }),
        new TextRun({ text: test.instructions || "Lee atentamente cada pregunta y responde según lo solicitado." })
      ],
      spacing: { after: 600 }
    })
  ];

  // 3. Add Questions
  items.forEach((item: any, index: number) => {
    const q = item.question_bank;
    const qNum = index + 1;

    // The question text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${qNum}. `, bold: true }),
          new TextRun({ text: q.question_text }),
          new TextRun({ text: ` (${item.points} pt${item.points !== 1 ? 's' : ''})`, italics: true, color: "666666" })
        ],
        spacing: { before: 400, after: 200 }
      })
    );

    // Question options/body based on type
    if (q.q_type === 'multiple_choice') {
      const allOptions = [q.correct_answer, ...(q.distractors || [])];
      // In a real app we'd randomize options, but for the teacher version we need to know which is which.
      // Easiest is to always randomize but mark the correct one for teachers.
      const letters = ['a', 'b', 'c', 'd'];
      
      letters.forEach((letter, i) => {
        const isCorrect = i === 0; // Assume we randomize later; for now just list them
        const optionText = allOptions[i] || "";
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: `    ${letter}) `, 
                bold: isTeacherVersion && isCorrect,
                color: isTeacherVersion && isCorrect ? "008800" : "000000" 
              }),
              new TextRun({ 
                text: optionText,
                bold: isTeacherVersion && isCorrect,
                color: isTeacherVersion && isCorrect ? "008800" : "000000"
              })
            ],
            spacing: { after: 100 }
          })
        );
      });
      
    } else if (q.q_type === 'true_false') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "    ( V )  ( F )", bold: true })
          ],
          spacing: { after: 200 }
        })
      );
      if (isTeacherVersion) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `    Respuesta correcta: ${q.correct_answer}`, color: "008800", bold: true })
            ],
            spacing: { after: 100 }
          })
        );
      }
      
    } else if (q.q_type === 'development') {
      // Add empty lines for student to write
      if (!isTeacherVersion) {
        for (let i = 0; i < 5; i++) {
          children.push(new Paragraph({ text: "____________________________________________________________________________________", spacing: { after: 200 }, color: "CCCCCC" }));
        }
      } else {
        // Teacher sees the rubric
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Pauta de corrección esperada:", bold: true, color: "008800" })
            ],
            spacing: { before: 200 }
          }),
          new Paragraph({
            text: q.rubric || q.correct_answer,
            color: "008800",
            spacing: { after: 200 }
          })
        );
      }
    }

    // Add justification ONLY for teacher version
    if (isTeacherVersion && q.justification) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Justificación: ${q.justification}`, italics: true, color: "666666", size: 20 })
          ],
          spacing: { before: 100, after: 200 }
        })
      );
    }
  });

  // 4. Generate Document
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  return await Packer.toBuffer(doc);
}
