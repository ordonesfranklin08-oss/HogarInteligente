

const SUPABASE_URL =
"https://kkhqztzobicxipznafjq.supabase.co";

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtraHF6dHpvYmljeGlwem5hZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTI4NDIsImV4cCI6MjA5NDk2ODg0Mn0.9GgjX5qjOtq3YXXc1LdPmDepJ13yHhHKuxSD8qHn77A";

let supabaseClient = null;
let isSupabaseConfigured = false;

try {

    // Verificar que el SDK esté cargado
    if (window.supabase) {

        // Crear cliente Supabase
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

        isSupabaseConfigured = true;

        console.log(
            "⚡ [HogarInteligente] Conexión exitosa con base de datos real de Supabase."
        );

    } else {

        console.error(
            "❌ [HogarInteligente] El SDK de Supabase no está cargado."
        );

    }

} catch (error) {

    console.error(
        "❌ [HogarInteligente] Error al conectar Supabase:",
        error
    );

}

// Variables globales
window.supabaseClient = supabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;

window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
};
