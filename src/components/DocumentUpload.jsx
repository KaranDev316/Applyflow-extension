import { useEffect, useState } from 'react'
import { getApplicationFilesFromStorage, saveApplicationFilesToStorage } from '../storage/fileStorage.js'

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function fileNamePreview(name) {
  return name ? name : 'No file selected yet.'
}

function renderFileStatus(label, storedName, selectedFile) {
  if (selectedFile) {
    return `${label}: ${selectedFile.name}`
  }

  if (storedName) {
    return `${label}: ${storedName}`
  }

  return `${label}: Not uploaded`
}

function DocumentUpload({ disabled }) {
  const [storedResumeName, setStoredResumeName] = useState('')
  const [storedCoverLetterName, setStoredCoverLetterName] = useState('')
  const [storedResumeData, setStoredResumeData] = useState('')
  const [storedCoverLetterData, setStoredCoverLetterData] = useState('')
  const [resumeFile, setResumeFile] = useState(null)
  const [coverLetterFile, setCoverLetterFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadFiles() {
      try {
        const {
          resumeData,
          resumeFileName,
          coverLetterData,
          coverLetterFileName,
        } = await getApplicationFilesFromStorage()

        if (!isMounted) return

        setStoredResumeName(resumeFileName)
        setStoredResumeData(resumeData)
        setStoredCoverLetterName(coverLetterFileName)
        setStoredCoverLetterData(coverLetterData)
      } catch (error) {
        console.warn('DocumentUpload: failed to load saved files', error)
        if (isMounted) {
          setErrorMessage('Unable to load saved documents')
        }
      }
    }

    loadFiles()

    return () => {
      isMounted = false
    }
  }, [])

  const handleFileChange = (event) => {
    const { name, files } = event.target
    const file = files?.[0] ?? null

    if (name === 'resume') {
      setResumeFile(file)
    } else if (name === 'coverLetter') {
      setCoverLetterFile(file)
    }

    setErrorMessage('')
    setStatusMessage('')
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')
    setIsSaving(true)

    try {
      const resumeSource = resumeFile
        ? await readFileAsDataURL(resumeFile)
        : storedResumeData
      const resumeFileName = resumeFile
        ? resumeFile.name
        : storedResumeName

      if (!resumeSource || !resumeFileName) {
        setErrorMessage('Please upload a resume PDF before saving.')
        return
      }

      const coverLetterSource = coverLetterFile
        ? await readFileAsDataURL(coverLetterFile)
        : storedCoverLetterData
      const coverLetterFileName = coverLetterFile
        ? coverLetterFile.name
        : storedCoverLetterName

      await saveApplicationFilesToStorage({
        resumeData: resumeSource,
        resumeFileName,
        coverLetterData: coverLetterSource,
        coverLetterFileName,
      })

      setStoredResumeName(resumeFileName)
      setStoredResumeData(resumeSource)
      setStoredCoverLetterName(coverLetterFileName)
      setStoredCoverLetterData(coverLetterSource)
      setResumeFile(null)
      setCoverLetterFile(null)
      setStatusMessage('Resume and cover letter settings saved.')
    } catch (error) {
      console.error('DocumentUpload: failed to save files', error)
      setErrorMessage('Unable to save documents. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-900">Resume & Cover Letter</h3>
      <p className="text-xs leading-5 text-slate-500">
        Upload a resume PDF and optional cover letter PDF once. These files will be automatically attached to Greenhouse application forms.
      </p>

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm text-slate-700">
          <span className="flex items-center justify-between font-medium text-slate-900">
            Resume PDF <span className="text-xs text-slate-500">required</span>
          </span>
          <input
            accept="application/pdf"
            disabled={disabled || isSaving}
            name="resume"
            onChange={handleFileChange}
            type="file"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <span className="text-xs text-slate-500">{renderFileStatus('Selected resume', storedResumeName, resumeFile)}</span>
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          <span className="flex items-center justify-between font-medium text-slate-900">
            Cover Letter PDF <span className="text-xs text-slate-500">optional</span>
          </span>
          <input
            accept="application/pdf"
            disabled={disabled || isSaving}
            name="coverLetter"
            onChange={handleFileChange}
            type="file"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <span className="text-xs text-slate-500">{renderFileStatus('Selected cover letter', storedCoverLetterName, coverLetterFile)}</span>
        </label>
      </div>

      {errorMessage && (
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      )}

      {statusMessage && (
        <p className="text-sm font-medium text-emerald-600">{statusMessage}</p>
      )}

      <button
        className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={disabled || isSaving}
        onClick={handleSave}
        type="button"
      >
        {isSaving ? 'Saving files…' : 'Save documents'}
      </button>
    </div>
  )
}

export default DocumentUpload
