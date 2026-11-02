import { useState } from 'react';
import DetailDialog from '../../../components/DetailDialog';
import { useApiData } from '../../../hooks/useApiData';
import type { Provider } from '../types/providers.types';
import '../Providers.css';

function ProvidersPage() {
  const {
    data: providersData,
    loading,
    error,
  } = useApiData<Provider[]>('/providers');

  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [city, setCity] = useState('All');
  const [inNetworkOnly, setInNetworkOnly] = useState(true);
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<Provider | null>(null);

  if (loading) return <p role="status">Loading providers...</p>;
  if (error) return <p role="alert">Unable to load providers: {error}</p>;
  if (!providersData) return <p>No providers available.</p>;

  const specialties = [
    'All',
    ...new Set(providersData.map((p) => p.specialty)),
  ];

  const cities = [
    'All',
    ...new Set(providersData.map((p) => p.city)),
  ];

  const filteredProviders = providersData.filter((provider) => {
    const matchesSearch =
      `${provider.name} ${provider.facility} ${provider.city} ${provider.specialty}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesSpecialty =
      specialty === 'All' || provider.specialty === specialty;

    const matchesCity =
      city === 'All' || provider.city === city;

    const matchesNetwork =
      !inNetworkOnly || provider.networkStatus === 'In Network';

    const matchesAccepting =
      !acceptingOnly || provider.acceptingPatients;

    return (
      matchesSearch &&
      matchesSpecialty &&
      matchesCity &&
      matchesNetwork &&
      matchesAccepting
    );
  });

  return (
    <div className="providers-page">
      <h1>Find a Doctor</h1>
      <p>
        Search our fictional HealthBridge provider network.
      </p>

      <section className="providers-panel">
        <div className="provider-filters">
          <input
            aria-label="Search providers"
            placeholder="Search doctor, facility or city..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filter specialty"
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
          >
            {specialties.map((item) => (
              <option key={item} value={item}>
                {item === 'All' ? 'All Specialties' : item}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          >
            {cities.map((item) => (
              <option key={item} value={item}>
                {item === 'All' ? 'All Cities' : item}
              </option>
            ))}
          </select>
        </div>

        <div className="provider-checkboxes">
          <label>
            <input
              type="checkbox"
              checked={inNetworkOnly}
              onChange={(event) =>
                setInNetworkOnly(event.target.checked)
              }
            />
            In-network only
          </label>

          <label>
            <input
              type="checkbox"
              checked={acceptingOnly}
              onChange={(event) =>
                setAcceptingOnly(event.target.checked)
              }
            />
            Accepting new patients
          </label>
        </div>
      </section>

      <h2>{filteredProviders.length} Providers Found</h2>

      <div className="provider-grid">
        {filteredProviders.map((provider) => (
          <article className="provider-card" key={provider.id}>
            <h3>{provider.name}</h3>
            <p><strong>{provider.specialty}</strong></p>
            <p>{provider.facility}</p>
            <p>{provider.city}, {provider.state}</p>

            <span
              className={
                provider.networkStatus === 'In Network'
                  ? 'provider-in-network'
                  : 'provider-out-network'
              }
            >
              {provider.networkStatus}
            </span>

            <p>
              {provider.acceptingPatients
                ? 'Accepting new patients'
                : 'Not accepting new patients'}
            </p>

            <button
              type="button"
              className="provider-button"
              onClick={() => setSelectedProvider(provider)}
            >
              View Details
            </button>
          </article>
        ))}
      </div>

      {filteredProviders.length === 0 && (
        <p>No providers match your search criteria.</p>
      )}

      {selectedProvider && (
        <DetailDialog title={selectedProvider.name} onClose={() => setSelectedProvider(null)}>
          <p><strong>Specialty:</strong> {selectedProvider.specialty}</p>
          <p><strong>Facility:</strong> {selectedProvider.facility}</p>
          <p>
            <strong>Address:</strong> {selectedProvider.address},{' '}
            {selectedProvider.city}, {selectedProvider.state}
          </p>
          <p><strong>Phone:</strong> {selectedProvider.phone ? <a href={`tel:${selectedProvider.phone}`}>{selectedProvider.phone}</a> : 'Not provided'}</p>
          <p>
            <strong>Network:</strong> {selectedProvider.networkStatus}
          </p>
          <p>
            <strong>New Patients:</strong>{' '}
            {selectedProvider.acceptingPatients ? 'Yes' : 'No'}
          </p>
        </DetailDialog>
      )}

      <p className="providers-disclaimer">
        Demo providers and contact details are fictional.
        Network participation must be verified before receiving care.
      </p>
    </div>
  );
}

export default ProvidersPage;
