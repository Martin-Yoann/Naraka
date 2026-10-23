import pg from 'pg';
import {readFile} from 'node:fs/promises';
let pool;
export function cloudPool(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');return pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:10000,allowExitOnIdle:true})}
export async function migrateCloud(db=cloudPool()){await db.query(await readFile(new URL('./cloud-schema.sql',import.meta.url),'utf8'));await db.query(await readFile(new URL('./cloud-auth-schema.sql',import.meta.url),'utf8'))}
export async function transaction(db,fn){const client=await db.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}
export async function closeCloud(){if(pool){await pool.end();pool=null}}
