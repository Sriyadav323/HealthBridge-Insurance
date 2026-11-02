import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ValidatedForm from './ValidatedForm';

it('shows field errors accessibly and focuses the first invalid input', async () => {
  const save = vi.fn();
  render(<ValidatedForm onSubmit={save}><label>Email<input name="email" type="email" required /></label><button>Save</button></ValidatedForm>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const input = screen.getByLabelText('Email');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveFocus();
  expect(input).toHaveAccessibleDescription();
  expect(save).not.toHaveBeenCalled();
  await user.type(input, 'valid@example.com');
  expect(input).not.toHaveAttribute('aria-invalid');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledOnce();
});

it('associates cross-field errors with the correct input', async () => {
  render(<ValidatedForm onSubmit={vi.fn()} validate={form => Number((form.elements.namedItem('limit') as HTMLInputElement).value) < 100 ? { limit: 'Enter at least 100.' } : {}}><label>Limit<input name="limit" type="number" defaultValue="10" /></label><button>Save</button></ValidatedForm>);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByLabelText('Limit')).toHaveAccessibleDescription('Enter at least 100.');
});

it('protects unsaved forms on link navigation and reload', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const { unmount } = render(<ValidatedForm onSubmit={vi.fn()} dirty><a href="/admin/members">Cancel edit</a></ValidatedForm>);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  screen.getByRole('link', { name: 'Cancel edit' }).dispatchEvent(event);
  expect(confirm).toHaveBeenCalledOnce();
  expect(event.defaultPrevented).toBe(true);
  const unload = new Event('beforeunload', { cancelable: true });
  fireEvent(window, unload);
  expect(unload.defaultPrevented).toBe(true);
  unmount();
  const cleanUnload = new Event('beforeunload', { cancelable: true });
  fireEvent(window, cleanUnload);
  expect(cleanUnload.defaultPrevented).toBe(false);
});
