const { Pool } = require('pg');
const pool = new Pool({connectionString:process.env.DATABASE_URL, ssl:false});
const express = require('express');
const app = express();
app.use(express.json());
function auth(req,res,next){if(!req.session?.user)return res.status(401).json({error:'No autenticado'});next()}
// This module is loaded by the main server through the startup command.
async function db(sql,p=[]){return (await pool.query(sql,p)).rows}
async function init(){await db(`CREATE TABLE IF NOT EXISTS cash_registers(id BIGSERIAL PRIMARY KEY,user_id INT,opened_at TIMESTAMPTZ DEFAULT NOW(),closed_at TIMESTAMPTZ,opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,closing_amount NUMERIC(12,2),expected_amount NUMERIC(12,2),difference NUMERIC(12,2),status VARCHAR(20) DEFAULT 'open');CREATE TABLE IF NOT EXISTS cash_register_movements(id BIGSERIAL PRIMARY KEY,register_id BIGINT REFERENCES cash_registers(id) ON DELETE CASCADE,type VARCHAR(30) NOT NULL,amount NUMERIC(12,2) NOT NULL,description TEXT,user_id INT,created_at TIMESTAMPTZ DEFAULT NOW());CREATE TABLE IF NOT EXISTS purchase_payments(id BIGSERIAL PRIMARY KEY,purchase_id BIGINT REFERENCES purchases(id) ON DELETE CASCADE,amount NUMERIC(12,2) NOT NULL,payment_method VARCHAR(30) DEFAULT 'cash',created_at TIMESTAMPTZ DEFAULT NOW());CREATE TABLE IF NOT EXISTS returns(id BIGSERIAL PRIMARY KEY,sale_id BIGINT REFERENCES sales(id),user_id INT,reason TEXT,total NUMERIC(12,2) DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW());CREATE TABLE IF NOT EXISTS return_items(id BIGSERIAL PRIMARY KEY,return_id BIGINT REFERENCES returns(id) ON DELETE CASCADE,product_id INT REFERENCES products(id),quantity NUMERIC(12,3),unit_price NUMERIC(12,2),total NUMERIC(12,2));`)}
async function start(){await init();const srv=process.env.MAIN_PORT||process.env.PORT||3000;return srv}
// Expose a tiny standalone HTTP API only when explicitly run; main POS keeps its existing routes.
if(require.main===module){const s=express();s.use(express.json());s.get('/health-extra',(q,r)=>r.json({ok:true}));s.listen(process.env.EXTRA_PORT||3010)}
module.exports={init,pool}
