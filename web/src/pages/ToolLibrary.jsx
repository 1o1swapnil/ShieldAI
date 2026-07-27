import { useEffect, useState } from 'react';
import { getToolLibrary, addLibraryTool } from '../api.js';

const SOURCE_LABEL = {
  library_seed: 'Library',
  classifier_confirmed: 'Classifier-confirmed',
  admin_manual: 'Admin-added',
};

// Section 12: the real AI tool library (150+ seeded tools) plus whatever
// the classifier confirms or an admin adds manually (e.g. a self-hosted
// LLM endpoint — Section 1.2's "Admin adds internal tool entries").
export default function ToolLibrary() {
  const [tools, setTools] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', domain: '', category: 'other' });

  const load = () => getToolLibrary().then(setTools).catch((e) => setError(e.message));

  useEffect(load, []);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.domain) return;
    addLibraryTool(form)
      .then(() => {
        setForm({ name: '', domain: '', category: 'other' });
        load();
      })
      .catch((e2) => setError(e2.message));
  };

  if (error) return <p>Error: {error}</p>;
  if (!tools) return <p>Loading…</p>;

  return (
    <div>
      <h2>Tool Library ({tools.length})</h2>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Name (e.g. Internal LLM)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Domain (e.g. llm.internal.corp)"
          value={form.domain}
          onChange={(e) => setForm({ ...form, domain: e.target.value })}
        />
        <input
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <button type="submit">Add tool</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Domain</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Category</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((t) => (
            <tr key={t.id}>
              <td style={{ padding: '4px 8px 4px 0' }}>{t.name}</td>
              <td style={{ padding: '4px 8px' }}>{t.domain}</td>
              <td style={{ padding: '4px 8px' }}>{t.category}</td>
              <td style={{ padding: '4px 8px' }}>{SOURCE_LABEL[t.source] || t.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
