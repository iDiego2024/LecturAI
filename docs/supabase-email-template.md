# Template de confirmación para Supabase

Comprendia usa Supabase Auth para el correo de confirmación de cuenta.

## Archivo listo para usar

La plantilla HTML quedó en:

- `supabase/templates/confirmation.html`

## Cómo activarlo en Supabase Cloud

1. Entra al proyecto en Supabase.
2. Ve a `Authentication`.
3. Abre `Email Templates`.
4. En `Confirm signup`, reemplaza el contenido HTML por el contenido de `supabase/templates/confirmation.html`.
5. Cambia el asunto por:

```text
Confirma tu correo para entrar a Comprendia
```

## Variables usadas por la plantilla

La plantilla usa variables oficiales de Supabase:

- `{{ .ConfirmationURL }}`
- `{{ .SiteURL }}`
- `{{ .Email }}`
- `{{ .Data.full_name }}`
- `{{ .Data.school_name }}`

Estas variables están documentadas por Supabase en:

- https://supabase.com/docs/guides/auth/auth-email-templates

## Flujo implementado en la app

Además del template, el registro en Comprendia ahora:

- envía el enlace de confirmación con redirect a `/login?confirmed=1`
- muestra un mensaje claro si la cuenta quedó pendiente de confirmación
- muestra un mensaje de éxito en login después de confirmar el correo

## Nota importante

Si usas `redirectTo`, asegúrate de que la URL esté permitida en:

- `Authentication` → `URL Configuration` → `Redirect URLs`

Ejemplo recomendado para producción:

```text
https://tu-dominio.com/login?confirmed=1
```
