export interface Provider {
  id: string;
  name: string;
  specialty: string;
  facility: string;
  city: string;
  state: string;
  networkStatus: 'In Network' | 'Out of Network';
  acceptingPatients: boolean;
  phone: string;
  address: string;
}
