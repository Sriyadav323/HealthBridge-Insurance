import InsuranceIdCard from '../components/InsuranceIdCard';
import '../IdCard.css';

function IdCardPage() {
  return (
    <div className="id-card-page">
      <div className="no-print">
        <h1>Digital ID Card</h1>
        <p>
          View your HealthBridge Insurance member ID card.
        </p>
      </div>

      <InsuranceIdCard />

      <p className="id-card-disclaimer no-print">
        This card contains fictional member information
        for application development and testing only.
      </p>
    </div>
  );
}

export default IdCardPage;
