const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pos_admin:PosSecure_2026!Db_9x7Q@localhost:5432/pos';
const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? false : false });

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'pos-session-change-me', resave: false, saveUninitialized: false, cookie: { maxAge: 1000 * 60 * 60 * 12 } }));
app.use(express.static('public'));

async function db(sql, params = []) { const r = await pool.query(sql, params); return r.rows; }
async function initDb() {
  await db(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, username VARCHAR(60) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(30) NOT NULL DEFAULT 'cashier', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, sku VARCHAR(80) UNIQUE NOT NULL, barcode VARCHAR(120) UNIQUE, name VARCHAR(180) NOT NULL, description TEXT, category_id INT REFERENCES categories(id) ON DELETE SET NULL, cost NUMERIC(12,2) NOT NULL DEFAULT 0, price NUMERIC(12,2) NOT NULL DEFAULT 0, stock NUMERIC(12,3) NOT NULL DEFAULT 0, min_stock NUMERIC(12,3) NOT NULL DEFAULT 5, unit VARCHAR(30) DEFAULT 'unidad', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS products_name_idx ON products USING gin (to_tsvector('spanish', name));
  CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, phone VARCHAR(40), email VARCHAR(160), address TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS suppliers (id SERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, phone VARCHAR(40), email VARCHAR(160), address TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS sales (id BIGSERIAL PRIMARY KEY, invoice_no VARCHAR(50) UNIQUE NOT NULL, customer_id INT REFERENCES customers(id) ON DELETE SET NULL, user_id INT REFERENCES users(id) ON DELETE SET NULL, subtotal NUMERIC(12,2) NOT NULL, tax NUMERIC(12,2) NOT NULL DEFAULT 0, discount NUMERIC(12,2) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL, payment_method VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'completed', created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS sale_items (id BIGSERIAL PRIMARY KEY, sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE, product_id INT REFERENCES products(id) ON DELETE RESTRICT, quantity NUMERIC(12,3) NOT NULL, unit_price NUMERIC(12,2) NOT NULL, cost NUMERIC(12,2) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL);
  CREATE TABLE IF NOT EXISTS purchases (id BIGSERIAL PRIMARY KEY, supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL, invoice_no VARCHAR(80), total NUMERIC(12,2) NOT NULL DEFAULT 0, user_id INT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS purchase_items (id BIGSERIAL PRIMARY KEY, purchase_id BIGINT REFERENCES purchases(id) ON DELETE CASCADE, product_id INT REFERENCES products(id) ON DELETE RESTRICT, quantity NUMERIC(12,3) NOT NULL, unit_cost NUMERIC(12,2) NOT NULL, total NUMERIC(12,2) NOT NULL);
  CREATE TABLE IF NOT EXISTS stock_movements (id BIGSERIAL PRIMARY KEY, product_id INT REFERENCES products(id) ON DELETE CASCADE, type VARCHAR(30) NOT NULL, quantity NUMERIC(12,3) NOT NULL, reference VARCHAR(100), user_id INT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS cash_movements (id BIGSERIAL PRIMARY KEY, type VARCHAR(30) NOT NULL, amount NUMERIC(12,2) NOT NULL, description TEXT, user_id INT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(120) NOT NULL, details JSONB, created_at TIMESTAMPTZ DEFAULT NOW());`);
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(adminPass, 10);
  await db(`INSERT INTO users(name, username, password_hash, role) VALUES('Administrador','admin',$1,'admin') ON CONFLICT(username) DO NOTHING`, [hash]);
  await db(`INSERT INTO categories(name) VALUES('General') ON CONFLICT(name) DO NOTHING`);
}

function auth(req,res,next){ if(!req.session.user) return res.status(401).json({error:'No autenticado'}); next(); }
function admin(req,res,next){ if(req.session.user?.role !== 'admin') return res.status(403).json({error:'Permisos insuficientes'}); next(); }
function safeLike(q){ return `%${String(q||'').trim()}%`; }

app.post('/api/login', async (req,res)=>{ try { const {username,password}=req.body; const rows=await db('SELECT id,name,username,password_hash,role FROM users WHERE username=$1 AND active=true',[username]); if(!rows[0] || !(await bcrypt.compare(password,rows[0].password_hash))) return res.status(401).json({error:'Usuario o contraseña incorrectos'}); const u=rows[0]; delete u.password_hash; req.session.user=u; await db('INSERT INTO audit_logs(user_id,action,details) VALUES($1,$2,$3)',[u.id,'LOGIN',JSON.stringify({username:u.username})]); res.json({user:u}); } catch(e){res.status(500).json({error:e.message});} });
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));

app.get('/api/dashboard',auth,async(req,res)=>{try{const [sales,stock,low,products,customers]=await Promise.all([db("SELECT COALESCE(SUM(total),0) total, COUNT(*) count FROM sales WHERE status='completed' AND created_at::date=CURRENT_DATE"),db('SELECT COALESCE(SUM(stock*cost),0) value FROM products WHERE active=true'),db('SELECT COUNT(*) count FROM products WHERE active=true AND stock<=min_stock'),db('SELECT COUNT(*) count FROM products WHERE active=true'),db('SELECT COUNT(*) count FROM customers')]); const chart=await db("SELECT to_char(d,'DD/MM') day, COALESCE(SUM(s.total),0) total FROM generate_series(CURRENT_DATE-6,CURRENT_DATE,'1 day') d LEFT JOIN sales s ON s.created_at::date=d AND s.status='completed' GROUP BY d ORDER BY d"); res.json({sales:sales[0],stock:stock[0],low:low[0],products:products[0],customers:customers[0],chart});}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/products',auth,async(req,res)=>{try{const q=req.query.q; const rows=await db(`SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=true AND ($1='' OR p.name ILIKE $2 OR p.sku ILIKE $2 OR COALESCE(p.barcode,'') ILIKE $2) ORDER BY p.id DESC LIMIT 200`,[q||'',safeLike(q)]);res.json(rows)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/products',auth,async(req,res)=>{try{const {sku,barcode,name,description,category_id,cost,price,stock,min_stock,unit}=req.body; const rows=await db(`INSERT INTO products(sku,barcode,name,description,category_id,cost,price,stock,min_stock,unit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[sku,barcode||null,name,description||'',category_id||null,cost||0,price||0,stock||0,min_stock||5,unit||'unidad']); if(Number(stock||0)!==0) await db('INSERT INTO stock_movements(product_id,type,quantity,reference,user_id) VALUES($1,$2,$3,$4,$5)',[rows[0].id,'initial',stock,'Alta de producto',req.session.user.id]);res.json(rows[0])}catch(e){res.status(400).json({error:e.message})}});
app.put('/api/products/:id',auth,async(req,res)=>{try{const {sku,barcode,name,description,category_id,cost,price,min_stock,unit}=req.body; const r=await db(`UPDATE products SET sku=$1,barcode=$2,name=$3,description=$4,category_id=$5,cost=$6,price=$7,min_stock=$8,unit=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,[sku,barcode||null,name,description||'',category_id||null,cost||0,price||0,min_stock||5,unit||'unidad',req.params.id]);res.json(r[0])}catch(e){res.status(400).json({error:e.message})}});
app.delete('/api/products/:id',auth,admin,async(req,res)=>{await db('UPDATE products SET active=false WHERE id=$1',[req.params.id]);res.json({ok:true})});
app.post('/api/products/:id/stock',auth,async(req,res)=>{try{const qty=Number(req.body.quantity||0), type=req.body.type==='out'?'out':'in'; if(qty<=0) return res.status(400).json({error:'Cantidad inválida'}); const delta=type==='in'?qty:-qty; const r=await db('UPDATE products SET stock=stock+$1,updated_at=NOW() WHERE id=$2 AND stock+$1>=0 RETURNING *',[delta,req.params.id]);if(!r[0])return res.status(400).json({error:'Stock insuficiente'});await db('INSERT INTO stock_movements(product_id,type,quantity,reference,user_id) VALUES($1,$2,$3,$4,$5)',[req.params.id,type,qty,req.body.reference||'Ajuste manual',req.session.user.id]);res.json(r[0])}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/categories',auth,async(req,res)=>res.json(await db('SELECT * FROM categories ORDER BY name')));
app.post('/api/categories',auth,async(req,res)=>{try{res.json((await db('INSERT INTO categories(name) VALUES($1) RETURNING *',[req.body.name]))[0])}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/customers',auth,async(req,res)=>res.json(await db('SELECT * FROM customers ORDER BY id DESC LIMIT 300')));
app.post('/api/customers',auth,async(req,res)=>res.json((await db('INSERT INTO customers(name,phone,email,address) VALUES($1,$2,$3,$4) RETURNING *',[req.body.name,req.body.phone||'',req.body.email||'',req.body.address||'']))[0]));
app.get('/api/suppliers',auth,async(req,res)=>res.json(await db('SELECT * FROM suppliers ORDER BY id DESC LIMIT 300')));
app.post('/api/suppliers',auth,async(req,res)=>res.json((await db('INSERT INTO suppliers(name,phone,email,address) VALUES($1,$2,$3,$4) RETURNING *',[req.body.name,req.body.phone||'',req.body.email||'',req.body.address||'']))[0]));

app.post('/api/sales',auth,async(req,res)=>{const client=await pool.connect();try{await client.query('BEGIN');const {items,customer_id,payment_method='cash',discount=0}=req.body;if(!Array.isArray(items)||!items.length)throw new Error('La venta no tiene productos');let subtotal=0;for(const i of items){const p=(await client.query('SELECT id,name,price,cost,stock FROM products WHERE id=$1 AND active=true FOR UPDATE',[i.product_id])).rows[0];if(!p)throw new Error('Producto no encontrado');if(Number(p.stock)<Number(i.quantity))throw new Error(`Stock insuficiente: ${p.name}`);subtotal+=Number(i.quantity)*Number(i.unit_price??p.price)}const total=Math.max(0,subtotal-Number(discount||0));const invoice='V-'+Date.now();const sale=(await client.query(`INSERT INTO sales(invoice_no,customer_id,user_id,subtotal,discount,total,payment_method) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[invoice,customer_id||null,req.session.user.id,subtotal,discount||0,total,payment_method])).rows[0];for(const i of items){const p=(await client.query('SELECT cost,price FROM products WHERE id=$1',[i.product_id])).rows[0];const qty=Number(i.quantity), price=Number(i.unit_price??p.price), line=qty*price;await client.query('INSERT INTO sale_items(sale_id,product_id,quantity,unit_price,cost,total) VALUES($1,$2,$3,$4,$5,$6)',[sale.id,i.product_id,qty,price,p.cost,line]);await client.query('UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2',[qty,i.product_id]);await client.query('INSERT INTO stock_movements(product_id,type,quantity,reference,user_id) VALUES($1,$2,$3,$4,$5)',[i.product_id,'sale',qty,invoice,req.session.user.id]);}await client.query('INSERT INTO cash_movements(type,amount,description,user_id) VALUES($1,$2,$3,$4)',[payment_method,total,`Venta ${invoice}`,req.session.user.id]);await client.query('COMMIT');res.json(sale)}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.get('/api/sales',auth,async(req,res)=>res.json(await db(`SELECT s.*,u.name cashier,c.name customer FROM sales s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 300`)));
app.get('/api/sales/:id',auth,async(req,res)=>{const sale=(await db('SELECT * FROM sales WHERE id=$1',[req.params.id]))[0];const items=await db('SELECT si.*,p.name,p.sku FROM sale_items si JOIN products p ON p.id=si.product_id WHERE sale_id=$1',[req.params.id]);res.json({sale,items})});

app.get('/api/users',auth,admin,async(req,res)=>res.json(await db('SELECT id,name,username,role,active,created_at FROM users ORDER BY id')));
app.post('/api/users',auth,admin,async(req,res)=>{try{const hash=await bcrypt.hash(req.body.password,10);res.json((await db('INSERT INTO users(name,username,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,username,role,active',[req.body.name,req.body.username,hash,req.body.role||'cashier']))[0])}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/reports/sales',auth,async(req,res)=>{const rows=await db(`SELECT to_char(created_at::date,'YYYY-MM-DD') day, COUNT(*) tickets, COALESCE(SUM(total),0) total FROM sales WHERE status='completed' AND created_at>=CURRENT_DATE-30 GROUP BY created_at::date ORDER BY day`);res.json(rows)});
app.get('/api/stock-movements',auth,async(req,res)=>res.json(await db(`SELECT sm.*,p.name,p.sku,u.name user_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id LEFT JOIN users u ON u.id=sm.user_id ORDER BY sm.id DESC LIMIT 300`)));
app.get('/health',(req,res)=>res.json({status:'ok',service:'pos-inventario'}));

initDb().then(()=>app.listen(PORT,()=>console.log(`POS running on ${PORT}`))).catch(e=>{console.error(e);process.exit(1)});
