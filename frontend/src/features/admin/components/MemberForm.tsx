import ValidatedForm from '../../../components/ValidatedForm';
import { formatDate } from '../../../utils/date';
import { useState } from 'react';
import { useApiData } from '../../../hooks/useApiData';
import type { FormEvent } from 'react';
import type { MemberDetails, MemberWrite } from '../types/admin.types';

type InsurancePlan = { id?: number; planName: string; planType: MemberWrite['planType']; effectiveFrom?: string; effectiveTo?: string };
const planKey = (plan: InsurancePlan) => plan.id ? String(plan.id) : JSON.stringify([plan.planName, plan.planType]);

type Props = { initial?: MemberDetails; saving: boolean; onSave: (input: MemberWrite) => Promise<void>; submitLabel: string };
export default function MemberForm({ initial, saving, onSave, submitLabel }: Props) {
  const [fields, setFields] = useState<MemberWrite>(() => ({
    fullName: initial?.summary.fullName ?? '', email: initial?.summary.email ?? '',
    phone: initial?.summary.phone ?? '', address: initial?.address ?? '',
    planName: initial?.summary.planName ?? '', planType: initial?.summary.planType ?? 'PPO',
    coverageStatus: initial?.summary.coverageStatus ?? 'Active', version: initial?.summary.version,
  }));
  const [baseline] = useState(() => JSON.stringify(fields));
  const { data: plans, loading: loadingPlans, error: planError, reload } = useApiData<InsurancePlan[]>('/admin/plans');
  const options = [...(plans ?? [])];
  if (initial && !options.some(plan => !plan.id && plan.planName === initial.summary.planName && plan.planType === initial.summary.planType)) {
    options.unshift({ planName: initial.summary.planName, planType: initial.summary.planType });
  }
  const [typeFilter, setTypeFilter] = useState('');
  const visibleOptions = typeFilter ? options.filter(plan => plan.planType === typeFilter) : options;
  const selected = fields.planName ? planKey({ ...fields, id: fields.planId }) : '';
  function selectPlan(value: string) {
    const plan = options.find(option => planKey(option) === value);
    if (plan) setFields(previous => ({ ...previous, planName: plan.planName, planType: plan.planType, planId: plan.id }));
    else setFields(previous => ({ ...previous, planName: '' }));
  }
  function selectType(planType: string) {
    setTypeFilter(planType);
    setFields(previous => ({ ...previous, planType,
      planName: previous.planType === planType ? previous.planName : '', planId: previous.planType === planType ? previous.planId : undefined }));
  }
  function field(name: keyof MemberWrite, value: string) { setFields(previous => ({ ...previous, [name]: value })); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void onSave(fields); }
  return <ValidatedForm className="admin-form" onSubmit={submit} aria-busy={saving} dirty={JSON.stringify(fields) !== baseline}>
    <fieldset disabled={saving}><legend>Personal information</legend>
      <label>Full name<input required maxLength={150} autoComplete="name" value={fields.fullName} onChange={e => field('fullName', e.target.value)} /></label>
      <label>Email address<input required maxLength={255} type="email" autoComplete="email" value={fields.email} onChange={e => field('email', e.target.value)} /></label>
      <label>Phone number<input maxLength={30} type="tel" autoComplete="tel" value={fields.phone} onChange={e => field('phone', e.target.value)} /></label>
      <label>Address<input maxLength={255} autoComplete="street-address" value={fields.address} onChange={e => field('address', e.target.value)} /></label>
    </fieldset>
    <fieldset disabled={saving} className="member-coverage-fields"><legend>Insurance & coverage</legend>
      <label>Insurance plan<select required value={selected} onChange={e => selectPlan(e.target.value)} disabled={loadingPlans || !!planError} aria-describedby="insurance-plan-hint">
        <option value="" disabled>{loadingPlans ? 'Loading insurance plans…' : visibleOptions.length ? 'Select an insurance plan' : 'No published plans available'}</option>
        {visibleOptions.map(plan => <option key={planKey(plan)} value={planKey(plan)}>{plan.planName} · {plan.planType}{plan.effectiveFrom ? ` · ${formatDate(plan.effectiveFrom)} to ${formatDate(plan.effectiveTo)}` : initial ? ' · Current assignment' : ''}</option>)}
      </select></label>
      <label>Plan type<select value={fields.planType} onChange={event => selectType(event.target.value)} aria-describedby="insurance-plan-hint"><option>PPO</option><option>HMO</option><option>EPO</option></select></label>
      <label>Coverage status<select value={fields.coverageStatus} onChange={e => field('coverageStatus', e.target.value)}><option>Active</option><option>Inactive</option></select></label>
    </fieldset>
    <p id="insurance-plan-hint" className="admin-muted">Choosing a plan fills in its type. Changing the type clears the selected plan; choose a matching plan before saving.</p>
    {planError && <div role="alert"><p>Unable to load insurance plans: {planError}</p><button type="button" disabled={saving} onClick={reload}>Retry loading plans</button></div>}
    {!loadingPlans && !planError && options.length > 0 && visibleOptions.length === 0 && <p role="status">No existing {fields.planType} plans are available. Select another plan type.</p>}
    {!loadingPlans && !planError && options.length === 0 && <p role="status">No insurance plans are available yet. Publish a plan with its benefits before registering a member. <a href="/admin/plans">Create an insurance plan →</a></p>}
    <p className="admin-muted">Coverage status and login account status are managed separately. Selecting a published plan assigns its coverage and copays. Same-year plan changes preserve spending already recorded; a new benefit year starts at zero.</p>
    <div className="form-action-bar"><span className="form-action-hint">Review the details before saving.</span><a href="/admin/members">Cancel</a><button className="admin-primary" disabled={saving || loadingPlans || !!planError || !fields.planName}>{saving ? 'Saving...' : submitLabel}</button></div>
  </ValidatedForm>;
}
