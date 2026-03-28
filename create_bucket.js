const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function createBucket() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envConfig = {};
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) envConfig[key.trim()] = value.join('=').trim();
  });

  const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseServiceKey = envConfig['SUPABASE_SERVICE_ROLE_KEY'];

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('Creating books bucket...');
  const { data, error } = await supabase.storage.createBucket('books', {
    public: false,
    fileSizeLimit: 20971520, // 20 MB
    allowedMimeTypes: ['application/pdf', 'application/epub+zip']
  });

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
      console.log('Bucket already exists.');
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket "books" created successfully:', data);
  }
}

createBucket();
