import { YdbStore } from '../src/ydbStore.ts';
const st: any = new YdbStore('grpc://localhost:2136/?database=/local', 'x');
const real = st.sql;
const rec: any = (strings: any, ...values: any[]) => {
  const q = real(strings, ...values);
  const params = Object.fromEntries(Object.entries(q.parameters ?? {}).map(([k, v]: any) => [k, v.type?.constructor?.name + ':' + String(v.value ?? '').slice(0, 30)]));
  console.log('---\n' + q.text.replace(/\s+/g, ' ').trim() + '\n   ' + JSON.stringify(params));
  return Promise.resolve([[{ public_id: 'old-id', started_at: 5n, n: 3n, people: 2n }]]);
};
rec.begin = async (fn: any) => fn(rec); rec.unsafe = real.unsafe;
st.sql = rec;
await st.stats();
await st.upsert('dev', { runId: 'r1', runner: 'Катя', title: 'T', startedAt: 1758700000000, durationMs: 1800000, distanceM: 5000, elevationGainM: 3, splits: [1], preview: [[1, 2, 0]], track: [[1, 2, 0]] }, 'new');
await st.feed(Number.MAX_SAFE_INTEGER, 30);
await st.get('id');
await st.remove('dev', 'r1');
await st.since(0);
process.exit(0);
