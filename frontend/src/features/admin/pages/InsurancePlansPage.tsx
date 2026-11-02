import ValidatedForm from '../../../components/ValidatedForm';
import { planStatus } from '../planStatus';
import { formatDate } from '../../../utils/date';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApiData } from '../../../hooks/useApiData';
import { mutateApiData } from '../../../services/api';
import type { InsurancePlan, PlanCoverage } from '../types/admin.types';
import '../Admin.css';

const blankCoverage = (): PlanCoverage => ({ name: '', category: 'Medical', status: 'Covered', cost: '', notes: '' });
const empty = () => ({ planName: '', planType: 'PPO', effectiveFrom: '', effectiveTo: '', deductibleTotal: '', oopMaximum: '', primaryCare: '', specialist: '', urgentCare: '' });

export default function InsurancePlansPage() {
  const { data, loading, error, reload } = useApiData<InsurancePlan[]>('/admin/insurance-plans');
  const [fields, setFields] = useState(empty);
  const [coverage, setCoverage] = useState<PlanCoverage[]>([blankCoverage()]);
  const [editing, setEditing] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = editing && (fields.planType !== 'PPO' || Object.entries(fields).some(([key, value]) => key !== 'planType' && value !== '') || coverage.length !== 1 || coverage.some(item => item.name || item.cost || item.notes || item.category !== 'Medical' || item.status !== 'Covered'));
  function discardDraft() { return !dirty || window.confirm('Discard the unpublished plan changes?'); }
  function field(key: keyof ReturnType<typeof empty>, value: string) { setFields(previous => ({ ...previous, [key]: value })); }
  function service(index: number, key: keyof PlanCoverage, value: string) { setCoverage(previous => previous.map((item, i) => i === index ? { ...item, [key]: value } : item)); }
  function revise(plan: InsurancePlan) {
    if (!discardDraft()) return;
    setDraftKey(value => value + 1);
    setFields({ planName: plan.planName, planType: plan.planType, effectiveFrom: '', effectiveTo: '', deductibleTotal: String(plan.deductibleTotal), oopMaximum: String(plan.oopMaximum), primaryCare: String(plan.primaryCare), specialist: String(plan.specialist), urgentCare: String(plan.urgentCare) });
    setCoverage(plan.coverage.map(item => ({ ...item }))); setEditing(true); setFailure(''); setNotice('');
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFailure(''); setNotice('');
    if (fields.effectiveTo.slice(0,4) !== fields.effectiveFrom.slice(0,4)) { setFailure('Use dates within one calendar benefit year.'); return; }
    if (fields.effectiveTo < fields.effectiveFrom) { setFailure('End date must be on or after the start date.'); return; }
    if (Number(fields.oopMaximum) < Number(fields.deductibleTotal)) { setFailure('Out-of-pocket maximum must be at least the deductible.'); return; }
    setBusy(true);
    try {
      await mutateApiData('/admin/insurance-plans', 'POST', { ...fields,
        deductibleTotal: Number(fields.deductibleTotal), oopMaximum: Number(fields.oopMaximum), primaryCare: Number(fields.primaryCare), specialist: Number(fields.specialist), urgentCare: Number(fields.urgentCare), coverage });
      setNotice('Plan version published. Current, non-retired versions are available for enrollment.'); setEditing(false); setFields(empty()); setCoverage([blankCoverage()]); reload();
    } catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to publish plan.'); }
    finally { setBusy(false); }
  }
  async function retire(plan: InsurancePlan) {
    if (!window.confirm(`Retire ${plan.planName} (${formatDate(plan.effectiveFrom)}) from new enrollment? Existing members keep their assigned coverage.`)) return;
    setBusy(true); setFailure(''); setNotice('');
    try { await mutateApiData(`/admin/insurance-plans/${plan.id}/retire`, 'POST'); setNotice('Plan retired from new enrollment. Existing member coverage is unchanged.'); reload(); }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to retire plan.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-page"><div className="admin-heading"><div><p className="admin-eyebrow">COVERAGE, THOUGHTFULLY CONFIGURED</p><h1>Insurance Plans</h1></div><button className="admin-primary" disabled={busy} onClick={() => { if (!discardDraft()) return; setDraftKey(value => value + 1); setFields(empty()); setCoverage([blankCoverage()]); setEditing(true); setFailure(''); }}>Create plan</button></div>
    <p>Define coverage once, then assign it during member enrollment. Published versions keep existing members’ coverage stable.</p>
    {notice && <p role="status" className="success-notice">{notice}</p>}{failure && <p role="alert">{failure}</p>}
    {loading && <p role="status">Loading insurance plans...</p>}{error && <div role="alert"><p>{error}</p><button onClick={reload}>Retry loading plans</button></div>}
    {editing && <section className="admin-panel plan-editor"><h2>Publish a plan version</h2><p className="admin-muted">Use the plan’s approved benefit amounts. Effective dates must fall within one calendar benefit year. Publishing a revision does not move existing members to it.</p>
      <ValidatedForm key={draftKey} onSubmit={publish} className="admin-form" aria-busy={busy} dirty={!!dirty} validate={form => {
        const from = (form.elements.namedItem('effectiveFrom') as HTMLInputElement).value;
        const to = (form.elements.namedItem('effectiveTo') as HTMLInputElement).value;
        const deductible = (form.elements.namedItem('deductibleTotal') as HTMLInputElement).value;
        const maximum = (form.elements.namedItem('oopMaximum') as HTMLInputElement).value;
        const errors: Record<string,string> = {};
        if (from && to && from.slice(0,4) !== to.slice(0,4)) errors.effectiveTo = 'Use dates within one calendar benefit year.';
        else if (from && to && to < from) errors.effectiveTo = 'End date must be on or after the start date.';
        if (deductible && maximum && Number(maximum) < Number(deductible)) errors.oopMaximum = 'Maximum must be at least the deductible.';
        return errors;
      }}><fieldset disabled={busy}><legend>Plan and benefit amounts</legend>
        <label>Plan name<input required maxLength={150} value={fields.planName} onChange={e => field('planName', e.target.value)} /></label>
        <label>Plan type<select value={fields.planType} onChange={e => field('planType', e.target.value)}><option>PPO</option><option>HMO</option><option>EPO</option></select></label>
        <label>Effective from<input name="effectiveFrom" type="date" required value={fields.effectiveFrom} onChange={e => field('effectiveFrom', e.target.value)} /></label>
        <label>Effective through<input name="effectiveTo" type="date" required min={fields.effectiveFrom} value={fields.effectiveTo} onChange={e => field('effectiveTo', e.target.value)} /></label>
        {([['deductibleTotal', 'Annual deductible ($)'], ['oopMaximum', 'Out-of-pocket maximum ($)'], ['primaryCare', 'Primary care copay ($)'], ['specialist', 'Specialist copay ($)'], ['urgentCare', 'Urgent care copay ($)']] as const).map(([key,label]) => <label key={key}>{label}<input name={key} type="number" min="0" max="1000000" step="1" required value={fields[key]} onChange={e => field(key,e.target.value)} /></label>)}
      </fieldset>
      <h3>Medical & pharmacy coverage</h3><p className="admin-muted">Include covered services, exclusions, member costs, and any restrictions in the notes.</p>
      {coverage.map((item, index) => <fieldset disabled={busy} className="plan-service" key={index} aria-labelledby={`plan-service-heading-${index}`}>
        <div className="plan-service-header"><h3 id={`plan-service-heading-${index}`}>Service {index + 1}</h3><button type="button" disabled={coverage.length === 1} onClick={() => setCoverage(previous => previous.filter((_,i) => i !== index))}>Remove service {index + 1}</button></div>
        <div className="plan-service-grid">
        <label>Service name<input required maxLength={150} value={item.name} onChange={e => service(index,'name',e.target.value)} /></label>
        <label>Category<select value={item.category} onChange={e => service(index,'category',e.target.value)}><option>Medical</option><option>Pharmacy</option></select></label>
        <label>Coverage<select value={item.status} onChange={e => service(index,'status',e.target.value)}><option>Covered</option><option>Not Covered</option></select></label>
        <label>Member cost<input required maxLength={100} placeholder="e.g. $25 copay or Not covered" value={item.cost} onChange={e => service(index,'cost',e.target.value)} /></label>
        <label className="plan-service-notes">Notes / restrictions<textarea rows={2} maxLength={2000} value={item.notes} onChange={e => service(index,'notes',e.target.value)} /></label>
        </div>
      </fieldset>)}
      <div className="admin-actions form-action-bar"><button type="button" disabled={busy || coverage.length >= 100} onClick={() => setCoverage(previous => [...previous,blankCoverage()])}>Add service</button><button className="admin-primary" disabled={busy}>{busy ? 'Publishing...' : 'Publish plan version'}</button><button type="button" disabled={busy} onClick={() => { if (discardDraft()) setEditing(false); }}>Cancel</button></div>
      </ValidatedForm></section>}
    {data && !data.length && <section className="admin-panel"><h2>Your plan catalog starts here.</h2><p>Create your first plan to make configured coverage available during member enrollment. Existing members’ records are preserved.</p></section>}
    <div className="plan-catalog">{data?.map(plan => <article className="admin-panel plan-catalog-card" key={plan.id}><div className="admin-heading"><div><p className="admin-eyebrow">{plan.planType} · VERSION #{plan.id}</p><h2>{plan.planName}</h2></div><span className={`admin-badge plan-state-${planStatus(plan).toLowerCase()}`}>{planStatus(plan)}</span></div><p className="admin-muted">Effective {formatDate(plan.effectiveFrom)} through {formatDate(plan.effectiveTo)}</p>
      <p className="plan-availability-note">{planStatus(plan) === 'Scheduled' ? `Available for enrollment from ${formatDate(plan.effectiveFrom)}.` : planStatus(plan) === 'Expired' ? 'Coverage period ended. Publish a revised version for a new period.' : planStatus(plan) === 'Retired' ? 'Closed to new enrollment. Existing member coverage is preserved.' : 'Available in the member registration dropdown.'}</p>
      <dl className="admin-member-meta"><div><dt>Deductible</dt><dd>${plan.deductibleTotal.toLocaleString()}</dd></div><div><dt>Out-of-pocket maximum</dt><dd>${plan.oopMaximum.toLocaleString()}</dd></div><div><dt>Copays · primary / specialist / urgent</dt><dd>${plan.primaryCare} / ${plan.specialist} / ${plan.urgentCare}</dd></div></dl>
      <details><summary>{plan.coverage.length} coverage services and exclusions</summary><ul>{plan.coverage.map((item,i) => <li key={i}><strong>{item.name}</strong> · {item.category} · {item.status} · {item.cost}{item.notes && <p>{item.notes}</p>}</li>)}</ul></details>
      <div className="admin-actions"><button disabled={busy} onClick={() => revise(plan)}>Create revised version</button>{!plan.retired && <button disabled={busy} onClick={() => void retire(plan)}>Retire from enrollment</button>}</div>
    </article>)}</div>
  </div>;
}
