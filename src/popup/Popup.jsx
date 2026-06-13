import { useMemo, useState, Suspense, lazy } from 'react'
import ApplicationList from '../components/ApplicationList'
import JobMetadata from '../components/JobMetadata'
import PlatformStatus from '../components/PlatformStatus'
import ErrorBoundary from '../components/ErrorBoundary'
const ProfileForm = lazy(() => import('../components/ProfileForm'))
import SmartAutofill from '../components/SmartAutofill'
import { useApplicationHistory } from '../hooks/useApplicationHistory'
import { useAutofill } from '../hooks/useAutofill'
import { useAutofillStats } from '../hooks/useAutofillStats'
import { usePlatformDetection } from '../hooks/usePlatformDetection'
import { useProfile } from '../hooks/useProfile'
import { computeMetrics } from './dashboardUtils'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'applied', label: 'Applied' },
  { value: 'draft', label: 'Drafts' },
]

function Popup() {
  const [activeTab, setActiveTab] = useState('Summary')
  const [statusFilter, setStatusFilter] = useState('all')
  const profileState = useProfile()
  const platformState = usePlatformDetection()
  const { refreshStats } = useAutofillStats()
  const historyState = useApplicationHistory()
  const autofillState = useAutofill({
    isPlatformSupported: platformState.isPlatformSupported,
    onMetadata: platformState.setJobMetadata,
    onSuccess: async () => {
      await refreshStats()
      await historyState.refresh()
    },
    platformName: platformState.platformStatus?.name,
  })

  const metrics = computeMetrics(historyState.applications)
  const compactSummary = useMemo(
    () => `${metrics.total} applied · ${metrics.drafts} drafts · ${metrics.today} today`,
    [metrics.total, metrics.drafts, metrics.today],
  )

  return (
    <main className="w-80 max-w-full overflow-hidden bg-white p-4 text-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">ApplyFlow</p>
          <h1 className="mt-1 text-lg font-semibold leading-tight text-slate-900">
            Track applications
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Fast autofill for supported job boards.
          </p>
        </div>
        <button
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          type="button"
          onClick={() => setActiveTab('Profile')}
        >
          Profile
        </button>
      </div>

      <PlatformStatus
        isDetecting={platformState.isDetectingPlatform}
        status={platformState.platformStatus}
      />

      
      {platformState.jobMetadata && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <JobMetadata metadata={platformState.jobMetadata} />
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-slate-950/95 p-3 text-white shadow-sm ring-1 ring-slate-900/10">
        <SmartAutofill
          disabled={
            !platformState.isPlatformSupported ||
            profileState.isLoadingProfile ||
            platformState.isDetectingPlatform
          }
          isLoading={autofillState.isAutofilling}
          message={autofillState.autofillMessage}
          onAutofill={autofillState.handleAutofill}
          status={autofillState.autofillStatus}
        />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-full bg-slate-100 px-1 py-1 text-xs text-slate-500">
        {['Summary', 'Tracker'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1.5 transition ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Summary' && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          <p className="text-xs text-slate-500 mb-2" aria-live="polite" aria-atomic="true">
            {historyState.isLoading ? 'Loading application summary…' : compactSummary}
          </p>
        </div>
      )}

      {activeTab === 'Profile' && (
        <div className="mt-4">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading profile…</p>}>
            <ErrorBoundary>
              <ProfileForm
                isLoading={profileState.isLoadingProfile}
                isSaved={profileState.isSaved}
                isSaving={profileState.isSaving}
                loadError={profileState.loadError}
                onFieldChange={profileState.handleFieldChange}
                onLocationPhoneChange={profileState.handleLocationPhoneChange}
                onSubmit={profileState.handleSubmit}
                profile={profileState.profile}
                saveError={profileState.saveError}
                validationErrors={profileState.validationErrors}
              />
            </ErrorBoundary>
          </Suspense>
        </div>
      )}

      {activeTab === 'Tracker' && (
        <div className="mt-4 min-w-0 overflow-hidden">
          <div className="mb-3 flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  statusFilter === filter.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <ApplicationList
            applications={historyState.applications}
            error={historyState.error}
            isLoading={historyState.isLoading}
            onDelete={historyState.removeApplication}
            statusFilter={statusFilter}
          />
        </div>
      )}
    </main>
  )
}

export default Popup
