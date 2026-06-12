import { useEffect, useMemo, useState } from 'react'
import { Country, State, City } from 'country-state-city'
import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'

export default function ProfileLocationPhone({
  disabled,
  errors = {},
  onChange,
  profile,
}) {
  const [countryCode, setCountryCode] = useState(profile?.location?.country?.code || '')
  const [stateCode, setStateCode] = useState(profile?.location?.state?.code || '')
  const [cityName, setCityName] = useState(profile?.location?.city?.name || '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.personal?.phone?.nationalNumber || '')

  useEffect(() => {
    setCountryCode(profile?.location?.country?.code || '')
    setStateCode(profile?.location?.state?.code || '')
    setCityName(profile?.location?.city?.name || '')
    setPhoneNumber(profile?.personal?.phone?.nationalNumber || '')
  }, [
    profile?.location?.country?.code,
    profile?.location?.state?.code,
    profile?.location?.city?.name,
    profile?.personal?.phone?.nationalNumber,
  ])

  const countries = useMemo(() => Country.getAllCountries(), [])
  const availableStates = useMemo(
    () => (countryCode ? State.getStatesOfCountry(countryCode) : []),
    [countryCode],
  )
  const availableCities = useMemo(
    () => (countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : []),
    [countryCode, stateCode],
  )

  const publishChange = (nextCountryCode, nextStateCode, nextCityName, nextPhoneNumber) => {
    const countryData = nextCountryCode ? Country.getCountryByCode(nextCountryCode) : null
    const stateData = nextCountryCode && nextStateCode
      ? State.getStateByCodeAndCountry(nextStateCode, nextCountryCode)
      : null

    let phoneData = null
    if (nextCountryCode && nextPhoneNumber) {
      const parsed = parsePhoneNumberFromString(nextPhoneNumber, nextCountryCode)
      if (parsed?.isValid() && parsed.country === nextCountryCode) {
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
    setCountryCode(nextCountryCode)
    setStateCode('')
    setCityName('')
    publishChange(nextCountryCode, '', '', phoneNumber)
  }

  const handleStateChange = (event) => {
    const nextStateCode = event.target.value
    setStateCode(nextStateCode)
    setCityName('')
    publishChange(countryCode, nextStateCode, '', phoneNumber)
  }

  const handleCityChange = (event) => {
    const nextCityName = event.target.value
    setCityName(nextCityName)
    publishChange(countryCode, stateCode, nextCityName, phoneNumber)
  }

  const handlePhoneChange = (event) => {
    const nextPhoneNumber = event.target.value
    setPhoneNumber(nextPhoneNumber)
    publishChange(countryCode, stateCode, cityName, nextPhoneNumber)
  }

  const phonePrefix = countryCode ? `+${getCountryCallingCode(countryCode)}` : ''
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
          <span className="min-w-14 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-normal text-slate-600">
            {phonePrefix}
          </span>
          <input
            aria-invalid={Boolean(errors['personal.phone'])}
            className={`${controlClass} min-w-0 flex-1`}
            disabled={disabled || !countryCode}
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
