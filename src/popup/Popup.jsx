import { useState } from 'react'
import ApplicationList from '../components/ApplicationList'
import JobMetadata from '../components/JobMetadata'
import PlatformStatus from '../components/PlatformStatus'
import ProfileForm from '../components/ProfileForm'
import SmartAutofill from '../components/SmartAutofill'
import { useApplicationHistory } from '../hooks/useApplicationHistory'
import { useAutofill } from '../hooks/useAutofill'
import { useAutofillStats } from '../hooks/useAutofillStats'
import { usePlatformDetection } from '../hooks/usePlatformDetection'
import { useProfile } from '../hooks/useProfile'
import { computeMetrics } from './dashboardUtils'

const TABS = ['Dashboard', 'Profile', 'Tracker']

function Popup() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const profileState = useProfile()
  const platformState = usePlatformDetection()
  const { autofillStatsData, refreshStats } = useAutofillStats()
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

  return (
    <main className="w-80 bg-white p-4 text-slate-900">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
          AF
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">ApplyFlow</h1>
          <p className="text-xs text-slate-500">Job application helper</p>
        </div>
      </header>

      <PlatformStatus
        isDetecting={platformState.isDetectingPlatform}
        status={platformState.platformStatus}
      />

      {platformState.jobMetadata && (
        <div className="mt-2">
          <JobMetadata metadata={platformState.jobMetadata} />
        </div>
      )}

      <div className="mb-4 mt-4">
        <SmartAutofill
          disabled={
            !platformState.isPlatformSupported ||
            profileState.isLoadingProfile ||
            platformState.isDetectingPlatform
          }
          isLoading={autofillState.isAutofilling}
          message={autofillState.autofillMessage}
          onAutofill={autofillState.handleAutofill}
          stats={autofillStatsData}
          status={autofillState.autofillStatus}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1.5" role="tablist" aria-label="Popup navigation">
        {TABS.map((tab) => (
          <button
            role="tab"
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 ${
              activeTab === tab
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
            aria-controls={`popup-${tab.toLowerCase()}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Dashboard' && (
        <div className="mb-4">
          {historyState.isLoading || profileState.isLoadingProfile ? (
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <div className="mx-auto h-6 w-12 rounded bg-slate-100 animate-pulse" />
                <p className="mt-2 text-xs text-slate-400">Total</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <div className="mx-auto h-6 w-12 rounded bg-slate-100 animate-pulse" />
                <p className="mt-2 text-xs text-slate-400">Today</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5" aria-live="polite" aria-atomic="true">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-slate-800">{metrics.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-emerald-600">{metrics.today}</p>
                <p className="text-xs text-slate-500">Today</p>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            {profileState.isLoadingProfile ? (
              <div className="col-span-1 h-9 rounded bg-slate-100 animate-pulse" aria-hidden="true" />
            ) : (
              <button
                className="col-span-1 rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white"
                type="button"
                onClick={() => autofillState.handleAutofill()}
                disabled={!platformState.isPlatformSupported || profileState.isLoadingProfile}
                aria-label="Autofill application"
                aria-busy={autofillState.isAutofilling}
                aria-disabled={!platformState.isPlatformSupported || profileState.isLoadingProfile}
              >
                Autofill
              </button>
            )}

            <button
              className="col-span-1 rounded-md border px-2 py-1.5 text-xs font-medium"
              type="button"
              onClick={() => setActiveTab('Tracker')}
              aria-label="Open tracker"
            >
              Tracker
            </button>
            <button
              className="col-span-1 rounded-md border px-2 py-1.5 text-xs font-medium"
              type="button"
              onClick={() => setActiveTab('Profile')}
              aria-label="Edit profile"
            >
              Edit Profile
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Profile' && (
        <ProfileForm
          isLoading={profileState.isLoadingProfile}
          isSaved={profileState.isSaved}
          isSaving={profileState.isSaving}
          loadError={profileState.loadError}
          onFieldChange={profileState.handleFieldChange}
          onSubmit={profileState.handleSubmit}
          profile={profileState.profile}
          saveError={profileState.saveError}
          validationErrors={profileState.validationErrors}
        />
      )}

      {activeTab === 'Tracker' && (
        <ApplicationList
          applications={historyState.applications}
          error={historyState.error}
          isLoading={historyState.isLoading}
          onDelete={historyState.removeApplication}
        />
      )}
    </main>
  )
}

export default Popup
