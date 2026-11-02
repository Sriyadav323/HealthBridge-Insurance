import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import CoverageTable from './CoverageTable';
import { benefitsData } from '../data/benefitsData';

it('combines accessible search and category controls and shows an empty state', async () => {
  const user = userEvent.setup();
  render(<CoverageTable items={benefitsData.coverage} />);
  await user.selectOptions(screen.getByLabelText('Filter coverage category'), 'Pharmacy');
  expect(screen.queryByText('Preventive Care')).not.toBeInTheDocument();
  expect(screen.getByText('Generic Prescriptions')).toBeVisible();
  await user.type(screen.getByLabelText('Search coverage'), '  generic  ');
  expect(screen.getByText('Generic Prescriptions')).toBeVisible();
  expect(screen.queryByText('Preferred Brand Drugs')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Search coverage'), 'missing');
  expect(screen.getByText('No matching coverage found.')).toBeVisible();
});
