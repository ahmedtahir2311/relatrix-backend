/**
 * Seed script — mirrors the MSW fixture data so the frontend works
 * out-of-the-box against the real backend.
 *
 * Run:  npm run db:seed
 */
import 'reflect-metadata';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import * as schema from './schema';
import { env } from '../config/env';

async function seed() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('🌱  Seeding database…\n');

  // ── Wipe existing data (order matters — FK constraints) ────────────────────
  await db.delete(schema.migrationJobs);
  await db.delete(schema.generationJobs);
  await db.delete(schema.dbConnections);
  await db.delete(schema.relationships);
  await db.delete(schema.columns);
  await db.delete(schema.tables);
  await db.delete(schema.schemas);
  await db.delete(schema.passwordResetTokens);
  await db.delete(schema.users);
  console.log('  ✓ Cleared existing data');

  // ── Demo user ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const [user] = await db
    .insert(schema.users)
    .values({ email: 'demo@reelatrix.dev', name: 'Demo User', passwordHash })
    .returning();
  console.log(`  ✓ User created → ${user.email}`);

  // ── E-commerce schema ──────────────────────────────────────────────────────
  const [ecomSchema] = await db
    .insert(schema.schemas)
    .values({ userId: user.id, name: 'ecommerce', description: 'Sample e-commerce data model' })
    .returning();

  // Tables
  const [usersTable] = await db
    .insert(schema.tables)
    .values({
      schemaId: ecomSchema.id,
      name: 'users',
      displayName: 'Users',
      color: '#6366f1',
      positionX: 100,
      positionY: 100,
    })
    .returning();

  const [ordersTable] = await db
    .insert(schema.tables)
    .values({
      schemaId: ecomSchema.id,
      name: 'orders',
      displayName: 'Orders',
      color: '#f59e0b',
      positionX: 420,
      positionY: 100,
    })
    .returning();

  const [productsTable] = await db
    .insert(schema.tables)
    .values({
      schemaId: ecomSchema.id,
      name: 'products',
      displayName: 'Products',
      color: '#10b981',
      positionX: 100,
      positionY: 380,
    })
    .returning();

  const [orderItemsTable] = await db
    .insert(schema.tables)
    .values({
      schemaId: ecomSchema.id,
      name: 'order_items',
      displayName: 'Order Items',
      color: '#ef4444',
      positionX: 420,
      positionY: 380,
    })
    .returning();

  // Columns — Users
  const [userIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: usersTable.id,
      name: 'id',
      dataType: 'UUID',
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
      position: 0,
    })
    .returning();

  await db.insert(schema.columns).values([
    { tableId: usersTable.id, name: 'email', dataType: 'VARCHAR', isUnique: true, isNullable: false, fakerProvider: 'internet.email', position: 1 },
    { tableId: usersTable.id, name: 'name', dataType: 'VARCHAR', isNullable: false, fakerProvider: 'person.fullName', position: 2 },
    { tableId: usersTable.id, name: 'created_at', dataType: 'TIMESTAMP', isNullable: false, defaultValue: 'now()', position: 3 },
  ]);

  // Columns — Orders
  const [orderIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: ordersTable.id,
      name: 'id',
      dataType: 'UUID',
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
      position: 0,
    })
    .returning();

  const [orderUserIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: ordersTable.id,
      name: 'user_id',
      dataType: 'UUID',
      isForeignKey: true,
      isNullable: false,
      position: 1,
    })
    .returning();

  await db.insert(schema.columns).values([
    { tableId: ordersTable.id, name: 'total', dataType: 'DECIMAL', isNullable: false, position: 2 },
    { tableId: ordersTable.id, name: 'status', dataType: 'VARCHAR', isNullable: false, defaultValue: "'pending'", position: 3 },
    { tableId: ordersTable.id, name: 'created_at', dataType: 'TIMESTAMP', isNullable: false, defaultValue: 'now()', position: 4 },
  ]);

  // Columns — Products
  const [productIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: productsTable.id,
      name: 'id',
      dataType: 'UUID',
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
      position: 0,
    })
    .returning();

  await db.insert(schema.columns).values([
    { tableId: productsTable.id, name: 'name', dataType: 'VARCHAR', isNullable: false, fakerProvider: 'commerce.productName', position: 1 },
    { tableId: productsTable.id, name: 'price', dataType: 'DECIMAL', isNullable: false, position: 2 },
    { tableId: productsTable.id, name: 'stock', dataType: 'INTEGER', isNullable: false, defaultValue: '0', position: 3 },
  ]);

  // Columns — Order Items
  const [oiIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: orderItemsTable.id,
      name: 'id',
      dataType: 'UUID',
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
      position: 0,
    })
    .returning();

  const [oiOrderIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: orderItemsTable.id,
      name: 'order_id',
      dataType: 'UUID',
      isForeignKey: true,
      isNullable: false,
      position: 1,
    })
    .returning();

  const [oiProductIdCol] = await db
    .insert(schema.columns)
    .values({
      tableId: orderItemsTable.id,
      name: 'product_id',
      dataType: 'UUID',
      isForeignKey: true,
      isNullable: false,
      position: 2,
    })
    .returning();

  await db.insert(schema.columns).values([
    { tableId: orderItemsTable.id, name: 'quantity', dataType: 'INTEGER', isNullable: false, defaultValue: '1', position: 3 },
    { tableId: orderItemsTable.id, name: 'unit_price', dataType: 'DECIMAL', isNullable: false, position: 4 },
  ]);

  // Relationships
  await db.insert(schema.relationships).values([
    {
      schemaId: ecomSchema.id,
      sourceTableId: usersTable.id,
      sourceColumnId: userIdCol.id,
      targetTableId: ordersTable.id,
      targetColumnId: orderUserIdCol.id,
      relationshipType: 'ONE_TO_MANY',
      minCardinality: 0,
      maxCardinality: 100,
      onDelete: 'CASCADE',
    },
    {
      schemaId: ecomSchema.id,
      sourceTableId: ordersTable.id,
      sourceColumnId: orderIdCol.id,
      targetTableId: orderItemsTable.id,
      targetColumnId: oiOrderIdCol.id,
      relationshipType: 'ONE_TO_MANY',
      minCardinality: 1,
      maxCardinality: 50,
      onDelete: 'CASCADE',
    },
    {
      schemaId: ecomSchema.id,
      sourceTableId: productsTable.id,
      sourceColumnId: productIdCol.id,
      targetTableId: orderItemsTable.id,
      targetColumnId: oiProductIdCol.id,
      relationshipType: 'ONE_TO_MANY',
      minCardinality: 0,
      maxCardinality: 1000,
      onDelete: 'RESTRICT',
    },
  ]);

  console.log(`  ✓ E-commerce schema → ${ecomSchema.id}`);

  // ── SaaS Billing schema ────────────────────────────────────────────────────
  const [saasSchema] = await db
    .insert(schema.schemas)
    .values({ userId: user.id, name: 'saas_billing', description: 'SaaS workspace billing model' })
    .returning();

  const [workspacesTable] = await db
    .insert(schema.tables)
    .values({
      schemaId: saasSchema.id,
      name: 'workspaces',
      displayName: 'Workspaces',
      color: '#8b5cf6',
      positionX: 100,
      positionY: 100,
    })
    .returning();

  const [membersTable] = await db
    .insert(schema.tables)
    .values({
      schemaId: saasSchema.id,
      name: 'members',
      displayName: 'Members',
      color: '#06b6d4',
      positionX: 420,
      positionY: 100,
    })
    .returning();

  const [wsIdCol] = await db
    .insert(schema.columns)
    .values({ tableId: workspacesTable.id, name: 'id', dataType: 'UUID', isPrimaryKey: true, isNullable: false, isUnique: true, position: 0 })
    .returning();

  await db.insert(schema.columns).values([
    { tableId: workspacesTable.id, name: 'name', dataType: 'VARCHAR', isNullable: false, fakerProvider: 'company.name', position: 1 },
    { tableId: workspacesTable.id, name: 'plan', dataType: 'VARCHAR', isNullable: false, defaultValue: "'free'", position: 2 },
    { tableId: workspacesTable.id, name: 'created_at', dataType: 'TIMESTAMP', isNullable: false, defaultValue: 'now()', position: 3 },
  ]);

  const [memberIdCol] = await db
    .insert(schema.columns)
    .values({ tableId: membersTable.id, name: 'id', dataType: 'UUID', isPrimaryKey: true, isNullable: false, isUnique: true, position: 0 })
    .returning();

  const [memberWsIdCol] = await db
    .insert(schema.columns)
    .values({ tableId: membersTable.id, name: 'workspace_id', dataType: 'UUID', isForeignKey: true, isNullable: false, position: 1 })
    .returning();

  await db.insert(schema.columns).values([
    { tableId: membersTable.id, name: 'email', dataType: 'VARCHAR', isNullable: false, fakerProvider: 'internet.email', position: 2 },
    { tableId: membersTable.id, name: 'role', dataType: 'VARCHAR', isNullable: false, defaultValue: "'member'", position: 3 },
  ]);

  await db.insert(schema.relationships).values({
    schemaId: saasSchema.id,
    sourceTableId: workspacesTable.id,
    sourceColumnId: wsIdCol.id,
    targetTableId: membersTable.id,
    targetColumnId: memberWsIdCol.id,
    relationshipType: 'ONE_TO_MANY',
    minCardinality: 1,
    maxCardinality: 100,
    onDelete: 'CASCADE',
  });

  console.log(`  ✓ SaaS Billing schema → ${saasSchema.id}`);

  // ── Demo DB connections ────────────────────────────────────────────────────
  const dummyEncrypted = Buffer.from('placeholder').toString('base64');

  await db.insert(schema.dbConnections).values([
    {
      userId: user.id,
      name: 'Local Postgres',
      dialect: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'myapp_dev',
      username: 'postgres',
      passwordEncrypted: dummyEncrypted,
      ssl: false,
      status: 'untested',
    },
    {
      userId: user.id,
      name: 'Staging Replica',
      dialect: 'postgresql',
      host: 'staging-db.internal',
      port: 5432,
      database: 'myapp_staging',
      username: 'readonly',
      passwordEncrypted: dummyEncrypted,
      ssl: true,
      status: 'failed',
      lastError: 'Connection refused: host unreachable',
    },
  ]);

  console.log('  ✓ DB connections created');

  console.log('\n✅  Seed complete!');
  console.log('   Login → demo@reelatrix.dev / demo1234\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
