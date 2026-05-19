import JobMetadata from '../components/JobMetadata'
import PlatformStatus from '../components/PlatformStatus'
import ProfileForm from '../components/ProfileForm'
import SmartAutofill from '../components/SmartAutofill'
import { useAutofill } from '../hooks/useAutofill'
import { useAutofillStats } from '../hooks/useAutofillStats'
import { usePlatformDetection } from '../hooks/usePlatformDetection'
import { useProfile } from '../hooks/useProfile'

const actions = ['Profile', 'Tracker']

function Popup() {
  const profileState = useProfile()
  const platformState = usePlatformDetection()
  const { autofillStatsData, refreshStats } = useAutofillStats()
  const autofillState = useAutofill({
    isPlatformSupported: platformState.isPlatformSupported,
    onMetadata: platformState.setJobMetadata,
    onSuccess: refreshStats,
    platformName: platformState.platformStatus?.name,
  })

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

      <div className="mb-4 grid grid-cols-2 gap-1.5">
        {actions.map((action) => (
          <button
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            key={action}
            type="button"
          >
            {action}
          </button>
        ))}
      </div>

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
    </main>
  )
}

export default Popup
