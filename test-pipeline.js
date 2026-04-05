const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bwhvfrcljzaqhfsnrxfo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aHZmcmNsanphcWhmc25yeGZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ3ODMxMiwiZXhwIjoyMDkwMDU0MzEyfQ.-rsTRoazOC_u_rcvxYW_JtVw814MIVuUSsCo_MWbPMc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching a user...');
  const { data: users, error: uErr } = await supabase.from('profiles').select('id').limit(1);
  if (uErr || !users || !users.length) {
     console.error('No profiles found in DB or error fetching!', uErr);
     return;
  }
  const userId = users[0].id;
  
  console.log('1. Creating Mock Book...');
  const { data: book, error: bErr } = await supabase.from('books').insert({
    user_id: userId,
    title: 'Test Resumable Book',
    author: 'Comprendia Tester',
    file_path: 'mock/test.pdf',
    file_size_bytes: 1024,
    processing_status: 'chunking'
  }).select().single();
  
  if (bErr) throw bErr;
  console.log('Book created:', book.id);
  
  const { data: job, error: jErr } = await supabase.from('book_jobs').insert({
    book_id: book.id,
    status: 'pending',
    total_chunks: 5,
    processed_chunks: 0,
    failed_chunks: 0
  }).select().single();
  
  if (jErr) throw jErr;
  
  const chunks = [];
  for (let i = 0; i < 5; i++) {
    chunks.push({
      job_id: job.id,
      chunk_index: i,
      status: 'pending',
      chunk_data: {
        content: `Este es el contenido de prueba para el chunk numero ${i}. El protagonista Juan hizo algo asombroso aquí. Se descubrió un gran misterio. Hubo conflicto con Pedro.`,
        pageNumber: 1
      }
    });
  }
  
  const { error: cErr } = await supabase.from('book_chunk_jobs').insert(chunks);
  if (cErr) throw cErr;
  
  console.log('Chunks and job created successfully! Starting polling mechanism...');
  
  let isDone = false;
  
  while (!isDone) {
     await new Promise(r => setTimeout(r, 2000));
     
     console.log('-> POST /api/books/' + book.id + '/process-chunks');
     const res = await fetch(`http://localhost:3000/api/books/${book.id}/process-chunks`, {
        method: 'POST',
        headers: {
          'x-test-admin-id': userId
        }
     });
     
     const data = await res.json();
     console.log('Response:', data);
     
     if (data.nextAction === 'consolidate') {
        console.log('-> Chunks done! Calling consolidate...');
        const resCon = await fetch(`http://localhost:3000/api/books/${book.id}/consolidate`, {
            method: 'POST',
            headers: {
              'x-test-admin-id': userId
            }
        });
        const dCon = await resCon.json();
        console.log('Consolidate Response:', dCon);
        isDone = true;
     } else if (data.error) {
        console.log('Error encountered, stopping test.');
        isDone = true;
     }
  }
}

run().catch(console.error);
