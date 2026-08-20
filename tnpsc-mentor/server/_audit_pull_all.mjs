import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows } = await c.query(`select id::text as id, aptitude_topic, question_text, question_text_ta,
    option_a, option_b, option_c, option_d, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
    correct_answer, explanation, explanation_ta
  from questions where category='aptitude' order by aptitude_topic, id`)
console.log('total rows:', rows.length)

const BATCHES = {
  batch1: ['Ratio And Proportion', 'Probability', 'Mathematical Operators'],
  batch2: ['Number Series', 'Analogy'],
  batch3: ['Percentage', 'LCM and HCF', 'Date Problems', 'Coding Decoding'],
  batch4: ['3D - Volume & Surface Area', '2D - Area', 'Perimeter, Circumference & Diameter'],
  batch5: ['Direction Based', 'Simple and Compound Interest', 'Dice Problems', 'Clock Problems'],
  batch6: ['Simplification', 'Time, Work , Speed And Distance', 'Time and Work', 'Compound Interest', 'Simple Interest', 'Puzzles'],
  batch7: ['Alphabet Series', 'Conversion of Information to Data', 'No Of Figures', 'Information Technology', 'AP, GP and Special Series', 'Parametric Representation', 'Seating Arrangement', 'Profit And Loss', 'Average, Mean Median Mode', 'Surds And Indices'],
}

let assigned = 0
for (const [batchName, topics] of Object.entries(BATCHES)) {
  const batchRows = rows.filter((r) => topics.includes(r.aptitude_topic))
  assigned += batchRows.length
  writeFileSync(`_audit_${batchName}.json`, JSON.stringify(batchRows, null, 1))
  console.log(`${batchName}: ${batchRows.length} rows (${topics.join(', ')})`)
}
console.log('total assigned:', assigned, '| total rows:', rows.length, assigned === rows.length ? 'OK' : 'MISMATCH')
await c.end()
