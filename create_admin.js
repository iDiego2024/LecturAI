const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function createAdmin() {
  // Read env manually since dotenv might not be installed for plain node
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envConfig = {};
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) envConfig[key.trim()] = value.join('=').trim();
  });

  const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseServiceKey = envConfig['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key in .env.local');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'admin@lecturai.cl';
  const password = 'password123';

  console.log('Creando usuario admin bypassing email limits...');
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Profesor Autómata' }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('El usuario ya existe. Credenciales: admin@lecturai.cl / password123');
    } else {
      console.error('Error creando usuario:', error.message);
    }
    return;
  } 

  console.log('Usuario creado exitosamente (Confirmado por admin):', data.user.id);
  
  // Insert into profiles
  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    email: email,
    full_name: 'Profesor Autómata',
    school_name: 'Colegio QA'
  });
  
  if (profileError) {
    console.error('Error insertando perfil:', profileError.message);
  } else {
    console.log('Perfil insertado correctamente.');
    console.log('LISTO: Puedes iniciar sesión con: admin@lecturai.cl / password123');
  }
}

createAdmin();
