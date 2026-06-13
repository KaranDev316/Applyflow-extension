import { useMemo, useState } from 'react'
import { Country, State, City } from 'country-state-city'
import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'

// Utility to get flag emoji for country code
function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌍'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt())
  return String.fromCodePoint(...codePoints)
}

export default function ProfileLocationPhone({
  disabled,
  errors = {},
  onChange,
  profile,
}) {
  const [showPhoneCountryDropdown, setShowPhoneCountryDropdown] = useState(false)
  const [phoneCountrySearch, setPhoneCountrySearch] = useState('')

  const countryCode = profile?.location?.country?.code || ''
  const stateCode = profile?.location?.state?.code || ''
  const cityName = profile?.location?.city?.name || ''
  // Some countries (e.g. AQ) don't have dialing codes in libphonenumber-js
  // and calling getCountryCallingCode will throw. Provide a safe lookup.
  const safeGetDialingCode = (iso) => {
    try {
      const code = getCountryCallingCode(iso)
      return code ? `+${code}` : ''
    } catch {
      return ''
    }
  }

  const phoneCountryCode = profile?.personal?.phone?.countryCode || (countryCode ? safeGetDialingCode(countryCode) : '')
  const phoneNumber = profile?.personal?.phone?.nationalNumber || ''

  const countries = useMemo(() => Country.getAllCountries(), [])
  
  // Get country name from phone country code
  const phoneCountryInfo = useMemo(() => {
    if (!phoneCountryCode) return null
    const code = phoneCountryCode.replace(/^\+/, '')
    for (const country of countries) {
      try {
        if (String(getCountryCallingCode(country.isoCode)) === code) {
          return { code: country.isoCode, name: country.name }
        }
      } catch {
        // ignore countries without dialing codes
      }
    }
    return null
  }, [phoneCountryCode, countries])

  // All countries with their dialing codes for the phone picker
  const phoneCountriesList = useMemo(() => {
    return countries
      .map((country) => {
        const dialing = safeGetDialingCode(country.isoCode)
        return {
          isoCode: country.isoCode,
          name: country.name,
          dialingCode: dialing,
          flag: getCountryFlag(country.isoCode),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [countries])

  // Filter countries based on search
  const filteredPhoneCountries = useMemo(() => {
    if (!phoneCountrySearch) return phoneCountriesList
    const search = phoneCountrySearch.toLowerCase()
    return phoneCountriesList.filter((c) =>
      c.name.toLowerCase().includes(search) ||
      c.dialingCode.includes(search)
    )
  }, [phoneCountriesList, phoneCountrySearch])

  const availableStates = useMemo(
    () => (countryCode ? State.getStatesOfCountry(countryCode) : []),
    [countryCode],
  )
  const availableCities = useMemo(
    () => (countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : []),
    [countryCode, stateCode],
  )

  const publishChange = (nextCountryCode, nextStateCode, nextCityName, nextPhoneCountryCode, nextPhoneNumber) => {
    const countryData = nextCountryCode ? Country.getCountryByCode(nextCountryCode) : null
    const stateData = nextCountryCode && nextStateCode
      ? State.getStateByCodeAndCountry(nextStateCode, nextCountryCode)
      : null

    let phoneData = null
    if (nextPhoneNumber) {
      const normalizedPhoneCode = nextPhoneCountryCode?.trim() || ''
      const phoneValue = normalizedPhoneCode
        ? `${normalizedPhoneCode.startsWith('+') ? normalizedPhoneCode : `+${normalizedPhoneCode}`}${nextPhoneNumber.trim()}`
        : nextPhoneNumber.trim()
      const parsed = parsePhoneNumberFromString(phoneValue, nextPhoneCountryCode ? undefined : nextCountryCode)

      if (parsed?.isValid()) {
        phoneData = {
          countryCode: `+${parsed.countryCallingCode}`,
          nationalNumber: parsed.nationalNumber,
          e164: parsed.number,
        }
      }
    }

    onChange({
      location: {
        country: countryData ? { code: countryData.isoCode, name: countryData.name } : null,
        state: stateData ? { code: stateData.isoCode, name: stateData.name } : null,
        city: nextCityName ? { name: nextCityName } : null,
      },
      phone: phoneData,
      phoneInput: nextPhoneNumber,
    })
  }

  const handleCountryChange = (event) => {
    const nextCountryCode = event.target.value
    const nextPhoneCountryCode = phoneCountryCode || (nextCountryCode ? `+${getCountryCallingCode(nextCountryCode)}` : '')
    publishChange(nextCountryCode, '', '', nextPhoneCountryCode, phoneNumber)
  }

  const handleStateChange = (event) => {
    const nextStateCode = event.target.value
    publishChange(countryCode, nextStateCode, '', phoneCountryCode, phoneNumber)
  }

  const handleCityChange = (event) => {
    const nextCityName = event.target.value
    publishChange(countryCode, stateCode, nextCityName, phoneCountryCode, phoneNumber)
  }

  const handlePhoneCountryCodeChange = (dialingCode) => {
    setShowPhoneCountryDropdown(false)
    setPhoneCountrySearch('')
    publishChange(countryCode, stateCode, cityName, dialingCode, phoneNumber)
  }

  const handlePhoneChange = (event) => {
    const nextPhoneNumber = event.target.value
    publishChange(countryCode, stateCode, cityName, phoneCountryCode, nextPhoneNumber)
  }

  const controlClass = 'rounded-md border border-slate-200 px-3 py-1.5 text-sm font-normal outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50'

  return (
    <div className="grid gap-2.5">
      <label className="grid gap-1 text-sm font-medium" htmlFor="location.country">
        Country
        <select
          aria-invalid={Boolean(errors['location.country'])}
          className={controlClass}
          disabled={disabled}
          id="location.country"
          name="location.country"
          onChange={handleCountryChange}
          value={countryCode}
        >
          <option value="">Select Country</option>
          {countries.map((country) => (
            <option key={country.isoCode} value={country.isoCode}>{country.name}</option>
          ))}
        </select>
        {errors['location.country'] && <span className="text-xs font-medium text-red-600">{errors['location.country']}</span>}
      </label>

      <label className="grid gap-1 text-sm font-medium" htmlFor="location.state">
        State
        <select
          aria-invalid={Boolean(errors['location.state'])}
          className={controlClass}
          disabled={disabled || !countryCode || availableStates.length === 0}
          id="location.state"
          name="location.state"
          onChange={handleStateChange}
          value={stateCode}
        >
          <option value="">Select State</option>
          {availableStates.map((state) => (
            <option key={state.isoCode} value={state.isoCode}>{state.name}</option>
          ))}
        </select>
        {errors['location.state'] && <span className="text-xs font-medium text-red-600">{errors['location.state']}</span>}
      </label>

      <label className="grid gap-1 text-sm font-medium" htmlFor="location.city">
        City
        {availableCities.length > 0 ? (
          <select
            aria-invalid={Boolean(errors['location.city'])}
            className={controlClass}
            disabled={disabled || !stateCode}
            id="location.city"
            name="location.city"
            onChange={handleCityChange}
            value={cityName}
          >
            <option value="">Select City</option>
            {availableCities.map((city) => (
              <option key={city.name} value={city.name}>{city.name}</option>
            ))}
          </select>
        ) : (
          <input
            aria-invalid={Boolean(errors['location.city'])}
            className={controlClass}
            disabled={disabled || !stateCode}
            id="location.city"
            name="location.city"
            onChange={handleCityChange}
            placeholder="Enter city"
            type="text"
            value={cityName}
          />
        )}
        {errors['location.city'] && <span className="text-xs font-medium text-red-600">{errors['location.city']}</span>}
      </label>

      <label className="grid gap-1 text-sm font-medium" htmlFor="personal.phone">
        Phone
        <div className="flex items-center gap-2">
          {/* Country Code Picker */}
          <div className="relative w-32">
            <button
              aria-expanded={showPhoneCountryDropdown}
              aria-invalid={Boolean(errors['personal.phone'])}
              className={`${controlClass} w-full text-left`}
              disabled={disabled}
              id="personal.phone.countryCode"
              onClick={() => setShowPhoneCountryDropdown(!showPhoneCountryDropdown)}
              type="button"
            >
              <span className="flex items-center justify-between">
                <span className="truncate">
                  {phoneCountryInfo
                    ? `${getCountryFlag(phoneCountryInfo.code)} ${phoneCountryCode}`
                    : '+1'}
                </span>
                <span className="text-xs">▼</span>
              </span>
            </button>

            {showPhoneCountryDropdown && !disabled && (
              <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                <input
                  className={`${controlClass} sticky top-0 w-full border-b`}
                  onChange={(e) => setPhoneCountrySearch(e.target.value)}
                  placeholder="Search country..."
                  type="text"
                  value={phoneCountrySearch}
                />
                <div className="max-h-40 overflow-auto">
                  {filteredPhoneCountries.map((country) => (
                    <button
                      className={`w-full px-3 py-2 text-left text-sm transition ${
                        phoneCountryCode === country.dialingCode
                          ? 'bg-slate-100 font-medium text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      key={country.isoCode}
                      onClick={() => handlePhoneCountryCodeChange(country.dialingCode)}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{country.flag}</span>
                        <span className="flex-1 truncate">{country.name}</span>
                        <span className="text-xs text-slate-500">{country.dialingCode}</span>
                      </span>
                    </button>
                  ))}
                  {filteredPhoneCountries.length === 0 && (
                    <div className="px-3 py-2 text-center text-sm text-slate-500">
                      No countries found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phone Number Input */}
          <input
            aria-invalid={Boolean(errors['personal.phone'])}
            className={`${controlClass} min-w-0 flex-1`}
            disabled={disabled}
            id="personal.phone"
            name="personal.phone"
            onChange={handlePhoneChange}
            placeholder="National number"
            type="tel"
            value={phoneNumber}
          />
        </div>
        {errors['personal.phone'] && <span className="text-xs font-medium text-red-600">{errors['personal.phone']}</span>}
      </label>
    </div>
  )
}
