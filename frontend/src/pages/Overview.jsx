import { api } from '../api'
import { usePolling } from '../hooks'
import Icon, { CATEGORY_ICON } from '../components/Icon'
import MiniMap from '../components/MiniMap'
import { Button, Card, Chip, IconTile, PageHeader, SectionTitle } from '../components/ui'
import { REPORT_CATEGORIES, statusChip } from '../lib/friendly'

export default function Overview({ go }) {
  const { data: incidents } = usePolling(() => api.get('/incidents'), 4000)
  const { data: tasks } = usePolling(() => api.get('/tasks'), 4000)
  const { data: stats } = usePolling(() => api.get('/admin/stats'), 4000)

  const list = incidents || []
  const taskOf = (id) => (tasks || []).find((t) => t.incident_id === id)
  const confirmed = (tasks || []).filter((t) => t.closure_confidence === 'VERIFIED').length
  const breached = stats?.totals.currently_breached ?? 0
  const openTasks = stats?.totals.open_tasks ?? 0
  const pulse = breached === 0 ? 'All on track' : breached / Math.max(openTasks, 1) < 0.5 ? 'Mostly on track' : 'Needs attention'
  const recent = [...list].sort((a, b) => b.id - a.id).slice(0, 4)
  const openNearby = list.filter((i) => i.status !== 'RESOLVED').length

  return (
    <div>
      <PageHeader eyebrow="Welcome back" title="Hello, neighbor" sub="Here's what's happening around your city today." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-primary p-7 text-primary-foreground md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-80">See something broken?</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">A better block starts with one small report.</h2>
          <p className="mt-3 max-w-md opacity-90">Tell us what and where. We'll route it to the right team and check with you that it's really fixed.</p>
          <Button variant="cream" className="mt-6" onClick={() => go('report')}>
            <Icon name="plus" className="h-4 w-4" /> Report a problem
          </Button>
        </div>
        <div className="grid gap-4">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Reports this month</p>
            <p className="mt-2 font-display text-5xl font-semibold">{stats?.totals.incidents ?? '-'}</p>
            <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground">{confirmed} fixed</b> and confirmed by residents</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Neighborhood pulse</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${breached === 0 ? 'bg-primary' : 'bg-destructive'}`} /> {pulse}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {breached === 0 ? 'Nothing is past its deadline' : `${breached} repair${breached === 1 ? ' is' : 's are'} past their deadline`}
            </p>
          </Card>
        </div>
      </div>

      <section className="mt-10">
        <SectionTitle right={<button className="text-sm font-semibold hover:underline" onClick={() => go('report')}>Start a report →</button>}>
          What would you like to report?
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => go('report', { category: c.key })} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted">
              <IconTile name={c.icon} />
              <span className="flex-1">
                <span className="block font-semibold">{c.title}</span>
                <span className="block text-sm text-muted-foreground">{c.sub}</span>
              </span>
              <Icon name="chevron" className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle right={<button className="text-sm font-semibold hover:underline" onClick={() => go('projects')}>All city projects →</button>}>
          Around the neighborhood
        </SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">City projects and report updates</p>
        <Card className="divide-y divide-border">
          {!recent.length && <p className="p-5 text-muted-foreground">No reports yet. Be the first to report a problem.</p>}
          {recent.map((i) => {
            const t = taskOf(i.id)
            const chip = statusChip(t, i)
            return (
              <div key={i.id} className="flex items-center gap-4 p-4">
                <IconTile name={CATEGORY_ICON[i.category]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.summary}</p>
                  <p className="text-sm text-muted-foreground">
                    {i.report_count > 1 ? `${i.report_count} reports merged into one` : '1 report'}
                    {t?.status === 'BLOCKED' ? ' · Starts after the related issue is cleared' : ''}
                    {t?.status === 'CLOSED' && t.closure_confidence === 'VERIFIED' ? ' · Confirmed fixed by residents' : ''}
                  </p>
                </div>
                <Chip tone={chip.tone}>{chip.label}</Chip>
              </div>
            )
          })}
        </Card>
      </section>

      <section className="mt-10 pb-6">
        <SectionTitle right={<Chip tone="peach" dot={false}>{openNearby} open nearby</Chip>}>Reports near you</SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">Demo area</p>
        <Card className="p-3">
          <MiniMap incidents={list} />
          <div className="mt-3 flex gap-4 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#6b7a4f]" /> Fixed</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#d9a441]" /> Open</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#c4573a]" /> Urgent</span>
          </div>
        </Card>
      </section>
    </div>
  )
}
