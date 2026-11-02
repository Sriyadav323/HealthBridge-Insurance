export default function TableSkeleton() {
  return <div className="table-skeleton" aria-hidden="true">{Array.from({ length: 5 }, (_, row) => <div className="skeleton-row" key={row}>{Array.from({ length: 4 }, (_, column) => <span key={column} />)}</div>)}</div>;
}
