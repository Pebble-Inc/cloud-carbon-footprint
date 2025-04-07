import { pool } from './connection';

interface InsertResult {
  id: number;
}

export async function addTenant(
  awsAccountId: string,
  region: string,
  env: string
): Promise<number> {
  try {
    const query = `
      INSERT INTO my_table (aws_account_id, region, env)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const values = [awsAccountId, region, env];
    const result = await pool.query<InsertResult>(query, values);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error inserting data:', error);
    throw error;
  }
}