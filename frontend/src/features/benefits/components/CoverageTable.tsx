import { useState } from 'react';
import type { CoverageItem } from '../types/benefits.types';

type Props = {
  items: CoverageItem[];
};

function CoverageTable({ items }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = items.filter((item) => {
    const matchesSearch =
      `${item.name} ${item.notes}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());

    const matchesCategory =
      category === 'All' || item.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <section className="benefit-copay-card">
      <h2>Coverage Details</h2>

      <div className="coverage-controls">
        <input
          aria-label="Search coverage"
          placeholder="Search medical or pharmacy benefits..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filter coverage category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="All">All Categories</option>
          <option value="Medical">Medical</option>
          <option value="Pharmacy">Pharmacy</option>
        </select>
      </div>

      <div className="coverage-table-wrapper">
        <table className="coverage-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Category</th>
              <th>Status</th>
              <th>Member Cost</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>
                  <span className={
                    item.status === 'Covered'
                      ? 'coverage-covered'
                      : 'coverage-not-covered'
                  }>
                    {item.status}
                  </span>
                </td>
                <td>{item.cost}</td>
                <td>{item.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p>No matching coverage found.</p>
        )}
      </div>
    </section>
  );
}

export default CoverageTable;
