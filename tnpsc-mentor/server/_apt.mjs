import 'dotenv/config'
import { Client } from 'pg'
const c=new Client({host:process.env.SUPABASE_DB_HOST,port:Number(process.env.SUPABASE_DB_PORT),user:process.env.SUPABASE_DB_USER,password:process.env.SUPABASE_DB_PASSWORD,database:process.env.SUPABASE_DB_NAME,ssl:{rejectUnauthorized:false}})
await c.connect()
for(const ty of ['numerics','reasoning']){
  const {rows}=await c.query(`select aptitude_topic, count(*) n from questions where category='aptitude' and aptitude_type=$1 group by aptitude_topic order by n desc`,[ty])
  console.log('\n===',ty,'— distinct topics:',rows.length)
  for(const r of rows.slice(0,40)) console.log(`  ${r.n}\t${r.aptitude_topic}`)
}
await c.end()
