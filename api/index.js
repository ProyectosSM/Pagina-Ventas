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

// --- PEDIDOS ---
app.get('/api/pedidos', async (req, res) => {
  try {
    const { usuario_id } = req.query;

    let query = supabase
      .from('pedidos')
      .select('*')
      .order('id', { ascending: false });

    if (usuario_id) {
      query = query.eq('usuario_id', usuario_id);
    }

    const { data: pedidosData, error } = await query;
    if (error) {
      console.error('Error GET /api/pedidos:', error);
      return res.status(500).json({ error: error.message });
    }

    const listaPedidos = Array.isArray(pedidosData) ? pedidosData : [];

    // Intentar adjuntar datos básicos del cliente si existe tabla usuarios
    const userIds = [...new Set(listaPedidos.map(p => p.usuario_id).filter(Boolean))];
    let usuariosMap = {};

    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('usuarios')
        .select('id, nombre, telefono, email')
        .in('id', userIds);

      if (Array.isArray(usersData)) {
        usersData.forEach(u => {
          usuariosMap[String(u.id)] = u;
        });
      }
    }

    const enriquecidos = listaPedidos.map(p => ({
      ...p,
      estado: p.estado || 'pendiente',
      cliente: usuariosMap[String(p.usuario_id)] || null
    }));

    res.json(enriquecidos);
  } catch (err) {
    console.error('Error inesperado GET /api/pedidos:', err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

app.post('/api/pedidos', async (req, res) => {
  try {
    const { usuario_id, detalle, total } = req.body;

    if (!detalle || !String(detalle).trim()) {
      return res.status(400).json({ error: 'El detalle del pedido es obligatorio.' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .insert([{
        usuario_id: usuario_id ? (Number.isNaN(Number(usuario_id)) ? usuario_id : Number(usuario_id)) : null,
        detalle: String(detalle).trim(),
        total: Number(total) || 0,
        estado: 'pendiente'
      }])
      .select('*')
      .single();

    if (error) {
      console.error('Error POST /api/pedidos:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error inesperado POST /api/pedidos:', err);
    res.status(500).json({ error: 'Error al guardar el pedido' });
  }
});

app.patch('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const estado = (req.body?.estado || 'entregado').trim().toLowerCase();

    if (!['pendiente', 'entregado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido.' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error PATCH /api/pedidos/:id/estado:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('Error inesperado PATCH /api/pedidos/:id/estado:', err);
    res.status(500).json({ error: 'Error al actualizar el estado del pedido' });
  }
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

// --- CATEGORÍAS ---
app.get('/api/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error GET /api/categorias:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Error inesperado GET /api/categorias:', err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

app.post('/api/categorias', async (req, res) => {
  try {
    const nombre = (req.body?.nombre || '').trim();
    const icono = (req.body?.icono || 'fa-tag').trim();
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }

    const { data, error } = await supabase
      .from('categorias')
      .insert([{ nombre, icono }])
      .select('*')
      .single();

    if (error) {
      console.error('Error POST /api/categorias:', error);
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Error inesperado POST /api/categorias:', err);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

app.delete('/api/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

// --- SUBCATEGORÍAS ---
app.get('/api/subcategorias', async (req, res) => {
  try {
    const { categoria_id } = req.query;
    let query = supabase
      .from('subcategorias')
      .select('*, categorias!categoria_id(id, nombre, icono)')
      .order('id', { ascending: true });

    if (categoria_id) {
      query = query.eq('categoria_id', categoria_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error GET /api/subcategorias:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Error inesperado GET /api/subcategorias:', err);
    res.status(500).json({ error: 'Error al obtener subcategorías' });
  }
});

app.post('/api/subcategorias', async (req, res) => {
  try {
    const nombre = (req.body?.nombre || '').trim();
    const icono = (req.body?.icono || 'fa-tag').trim();
    const rawCatId = req.body?.categoria_id;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la subcategoría es obligatorio.' });
    }
    if (rawCatId === undefined || rawCatId === null || String(rawCatId).trim() === '') {
      return res.status(400).json({ error: 'Debes seleccionar una categoría padre.' });
    }

    const categoriaIdLimpio = Number.isNaN(Number(rawCatId)) ? String(rawCatId).trim() : Number(rawCatId);

    const { data, error } = await supabase
      .from('subcategorias')
      .insert([{
        nombre,
        icono,
        categoria_id: categoriaIdLimpio
      }])
      .select('*, categorias!categoria_id(id, nombre, icono)')
      .single();

    if (error) {
      console.error('Error POST /api/subcategorias:', error);
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Error inesperado POST /api/subcategorias:', err);
    res.status(500).json({ error: 'Error al crear la subcategoría en el servidor.' });
  }
});

app.delete('/api/subcategorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('subcategorias').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar subcategoría' });
  }
});

// --- PRODUCTOS ---
app.get('/api/productos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias!categoria_id(id, nombre, icono), subcategorias!subcategoria_id(id, nombre, icono, categoria_id)')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error GET /api/productos:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Error inesperado GET /api/productos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { nombre, categoria_id, subcategoria_id, precio, imagen_url, descripcion } = req.body;
    const subIdLimpio =
      subcategoria_id !== undefined &&
      subcategoria_id !== null &&
      String(subcategoria_id).trim() !== ''
        ? Number(subcategoria_id)
        : null;

    const { data, error } = await supabase
      .from('productos')
      .insert([{
        nombre,
        categoria_id: categoria_id ? Number(categoria_id) : null,
        subcategoria_id: subIdLimpio,
        precio: Number(precio),
        imagen_url,
        descripcion
      }])
      .select('*, categorias!categoria_id(id, nombre, icono), subcategorias!subcategoria_id(id, nombre, icono, categoria_id)')
      .single();

    if (error) {
      console.error('Error POST /api/productos:', error);
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Error inesperado POST /api/productos:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria_id, subcategoria_id, precio, imagen_url, descripcion } = req.body;

    const subIdLimpio =
      subcategoria_id !== undefined &&
      subcategoria_id !== null &&
      String(subcategoria_id).trim() !== ''
        ? Number(subcategoria_id)
        : null;

    const { data, error } = await supabase
      .from('productos')
      .update({
        nombre,
        categoria_id: categoria_id ? Number(categoria_id) : null,
        subcategoria_id: subIdLimpio,
        precio: Number(precio),
        imagen_url,
        descripcion
      })
      .eq('id', id)
      .select('*, categorias!categoria_id(id, nombre, icono), subcategorias!subcategoria_id(id, nombre, icono, categoria_id)')
      .single();

    if (error) {
      console.error('Error PUT /api/productos/:id:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json(data);
  } catch (err) {
    console.error('Error inesperado PUT /api/productos/:id:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar el producto.' });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = app;

// Obtener subcategorías
app.get('/api/subcategorias', async (req, res) => {
  try {
    const { categoria_id } = req.query;
    let query = supabase
      .from('subcategorias')
      .select('*, categorias!categoria_id(id, nombre, icono)')
      .order('id', { ascending: true });

    if (categoria_id) {
      query = query.eq('categoria_id', categoria_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error GET /api/subcategorias:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Error inesperado GET /api/subcategorias:', err);
    res.status(500).json({ error: 'Error al obtener subcategorías' });
  }
});

// Crear subcategoría
app.post('/api/subcategorias', async (req, res) => {
  try {
    const nombre = (req.body?.nombre || '').trim();
    const icono = (req.body?.icono || 'fa-tag').trim();
    const rawCatId = req.body?.categoria_id;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la subcategoría es obligatorio.' });
    }
    if (rawCatId === undefined || rawCatId === null || String(rawCatId).trim() === '') {
      return res.status(400).json({ error: 'Debes seleccionar una categoría padre.' });
    }

    const categoriaIdLimpio = Number.isNaN(Number(rawCatId)) ? String(rawCatId).trim() : Number(rawCatId);

    const { data, error } = await supabase
      .from('subcategorias')
      .insert([{
        nombre,
        icono,
        categoria_id: categoriaIdLimpio
      }])
      .select('*, categorias!categoria_id(id, nombre, icono)')
      .single();

    if (error) {
      console.error('Error POST /api/subcategorias:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error inesperado POST /api/subcategorias:', err);
    res.status(500).json({ error: 'Error al crear la subcategoría en el servidor.' });
  }
});

// Eliminar subcategoría
app.delete('/api/subcategorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('subcategorias')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error DELETE /api/subcategorias/:id:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error inesperado DELETE /api/subcategorias/:id:', err);
    res.status(500).json({ error: 'Error al eliminar subcategoría.' });
  }
});

