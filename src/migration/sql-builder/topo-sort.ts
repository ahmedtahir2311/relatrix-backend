import type { TableDef, RelationshipDef } from './types';

// Kahn's algorithm — parent tables (referenced by FK) come first
export function topologicalSort(tables: TableDef[], relationships: RelationshipDef[]): TableDef[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tables) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const rel of relationships) {
    if (rel.sourceTableId === rel.targetTableId) continue;
    // targetTable provides a value that sourceTable references → target must come first
    adj.get(rel.targetTableId)?.push(rel.sourceTableId);
    inDegree.set(rel.sourceTableId, (inDegree.get(rel.sourceTableId) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const dep of (adj.get(id) ?? [])) {
      const newDeg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  const tableMap = new Map(tables.map((t) => [t.id, t]));
  // Tables not in sorted (cycle participants) go at the end
  const remaining = tables.filter((t) => !sorted.includes(t.id));
  return [...sorted.map((id) => tableMap.get(id)!), ...remaining];
}
