const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a Supabase usando Variables de Entorno de Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- validacion para portal admin ---
const path = require('path');

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// --- RUTAS DE AUTENTICACIÓN ---

// Registro de clientes
app.post('/api/registro', async (req, res) => {
    const { nombre, email, telefono, password } = req.body;
    const { data, error } = await supabase
        .from('usuarios')
        .insert([{ nombre, email, telefono, password, rol: 'cliente' }])
        .select()
        .single();

    if (error) return res.status(400).json({ error: 'El correo ya está registrado o datos inválidos.' });
    res.json({ usuario: data });
});

// Inicio de sesión (Clientes y Admin)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, email, telefono, rol')
        .eq('email', email)
        .eq('password', password)
        .single();

    if (error || !data) return res.status(401).json({ error: 'Credenciales incorrectas' });
    res.json({ usuario: data });
});

// --- RUTAS DE CATEGORÍAS Y PRODUCTOS ---

app.get('/api/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error en GET /api/categorias:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Error inesperado en /api/categorias:', err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// Crear categoría (Admin)
app.post('/api/categorias', async (req, res) => {
    const { nombre, icono } = req.body;
    const { data, error } = await supabase
        .from('categorias')
        .insert([{ nombre, icono: icono || 'fa-tag' }])
        .select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// Eliminar categoría (Admin)
app.delete('/api/categorias/:id', async (req, res) => {
    const { error } = await supabase.from('categorias').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
});

// Obtener productos con nombre de categoría
app.get('/api/productos', async (req, res) => {
    const { data, error } = await supabase
        .from('productos')
        .select('*, categorias(nombre)')
        .order('id', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Crear producto (Admin)
app.post('/api/productos', async (req, res) => {
    const { categoria_id, nombre, descripcion, precio, imagen_url } = req.body;
    const { data, error } = await supabase
        .from('productos')
        .insert([{ categoria_id, nombre, descripcion, precio, imagen_url }])
        .select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// Eliminar producto (Admin)
app.delete('/api/productos/:id', async (req, res) => {
    const { error } = await supabase.from('productos').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
});

// --- RUTA DE PEDIDOS ---
app.post('/api/pedidos', async (req, res) => {
    const { usuario_id, detalle, total } = req.body;
    const { data, error } = await supabase
        .from('pedidos')
        .insert([{ usuario_id, detalle, total }])
        .select()
        .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// Exportar para Vercel y escuchar en local
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
}

module.exports = app;
