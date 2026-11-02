
type DashboardCardProps = {
  title: string;
  description: string;
};

function DashboardCard({
  title,
  description,
}: DashboardCardProps) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default DashboardCard;
