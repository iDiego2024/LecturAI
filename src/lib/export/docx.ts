import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx';
import { createClient } from '../supabase/server';

interface ExportConfig {
  testId: string;
  isTeacherVersion: boolean;
  userId: string;
}

function stableHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getStableShuffledOptions(correctAnswer: string, distractors: string[] | null, seedSource: string) {
  const options = [
    { text: correctAnswer, isCorrect: true },
    ...((distractors || []).map((text) => ({ text, isCorrect: false }))),
  ];

  return options
    .map((option, index) => ({
      option,
      sortKey: stableHash(`${seedSource}:${index}:${option.text}`),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ option }) => option)
    .slice(0, 4);
}

export async function generateWordDocument({ testId, isTeacherVersion, userId }: ExportConfig) {
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
          metadata,
          rubric,
          justification
        )
      )
    `)
    .eq('id', testId)
    .eq('user_id', userId)
    .single();

  if (!test) throw new Error('Test not found');

  // Sort items by order
  const typedTest = test as any;
  const items = (typedTest.test_items || []).sort((a: any, b: any) => a.item_order - b.item_order);

  // 2. Build Document Elements
  const children: any[] = [
    new Paragraph({
      text: typedTest.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      text: `Libro: ${typedTest.books.title} ${typedTest.books.author ? `por ${typedTest.books.author}` : ''}`,
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
    new Paragraph({ text: `Curso: ${typedTest.target_grade || '_________________'}          Fecha: _________________`, spacing: { after: 400 } }),
    
    new Paragraph({
      children: [
        new TextRun({ text: "Instrucciones: ", bold: true }),
        new TextRun({ text: typedTest.instructions || "Lee atentamente cada pregunta y responde según lo solicitado." })
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
      const allOptions = getStableShuffledOptions(
        q.correct_answer,
        q.distractors || [],
        `${typedTest.id}:${q.question_text}`
      );
      const letters = ['a', 'b', 'c', 'd'];
      
      letters.forEach((letter, i) => {
        const currentOption = allOptions[i];
        const isCorrect = Boolean(currentOption?.isCorrect);
        const optionText = currentOption?.text || "";
        
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
      
    } else if (q.q_type === 'development' || q.q_type === 'creative_writing') {
      // Add empty lines for student to write
      if (!isTeacherVersion) {
        for (let i = 0; i < 5; i++) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "____________________________________________________________________________________",
                  color: "CCCCCC",
                }),
              ],
              spacing: { after: 200 },
            })
          );
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
            children: [new TextRun({ text: q.rubric || q.correct_answer, color: "008800" })],
            spacing: { after: 200 }
          })
        );
      }
    } else if (q.q_type === 'matching') {
      const pairs = Array.isArray(q.metadata?.matching_pairs) ? q.metadata.matching_pairs : [];
      pairs.forEach((pair: any, pairIndex: number) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `    ${pairIndex + 1}. `, bold: true }),
              new TextRun({ text: `${pair.left}  __________  ${pair.right}` }),
            ],
            spacing: { after: 100 }
          })
        );
      });

      if (isTeacherVersion && q.correct_answer) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Solucion guía: ${q.correct_answer}`, color: "008800", bold: true })],
            spacing: { before: 150, after: 200 }
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

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    title: typedTest.title as string,
  };
}
