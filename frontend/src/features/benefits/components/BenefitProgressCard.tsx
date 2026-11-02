
type BenefitProgressCardProps = {
  title: string;
  total: number;
  used: number;
  usedLabel: string;
};

function BenefitProgressCard({
  title,
  total,
  used,
  usedLabel,
}: BenefitProgressCardProps) {
  const remaining = Math.max(total - used, 0);

  const percentage =
    total > 0
      ? Math.min(Math.max((used / total) * 100, 0), 100)
      : 0;

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

  return (
    <div className="benefit-progress-card">
      <h3>{title}</h3>

      <p className="benefit-amount">
        {formatCurrency(used)} {usedLabel}
      </p>

      <div
        className="benefit-progress-track"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(Math.max(used, 0), total)}
      >
        <div
          className="benefit-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="benefit-progress-details">
        <span>{formatCurrency(remaining)} remaining</span>
        <span>{formatCurrency(total)} total</span>
      </div>
    </div>
  );
}

export default BenefitProgressCard;
