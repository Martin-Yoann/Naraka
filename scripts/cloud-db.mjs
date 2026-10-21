import {migrateCloud,cloudPool,closeCloud} from '../lib/cloud-db.mjs';
try{await migrateCloud();await cloudPool().query('SELECT 1');console.log('Cloud schema ready; database connection verified.')}catch{console.error('Cloud database initialization failed. Check DATABASE_URL and Neon project connectivity.');process.exitCode=1}finally{await closeCloud()}
