import { Country, State, City } from 'country-state-city'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'

export function getCountryByCodeOrName(value) {
  if (!value) return null
  if (typeof value === 'object') {
    return getCountryByCodeOrName(value.code || value.name)
  }

  const text = String(value).trim()
  const upper = text.toUpperCase()
  return Country.getCountryByCode(upper) ||
    Country.getAllCountries().find((country) => country.name.toLowerCase() === text.toLowerCase()) ||
    null
}

export function getStateByCodeOrName(value, countryCode) {
  if (!value || !countryCode) return null
  if (typeof value === 'object') {
    return getStateByCodeOrName(value.code || value.name, countryCode)
  }

  const text = String(value).trim()
  const upper = text.toUpperCase()
  return State.getStateByCodeAndCountry(upper, countryCode) ||
    State.getStatesOfCountry(countryCode).find((state) => state.name.toLowerCase() === text.toLowerCase()) ||
    null
}

export function getCityByName(value, countryCode, stateCode) {
  if (!value || !countryCode || !stateCode) return null
  if (typeof value === 'object') {
    return getCityByName(value.name, countryCode, stateCode)
  }

  const text = String(value).trim()
  return City.getCitiesOfState(countryCode, stateCode)
    .find((city) => city.name.toLowerCase() === text.toLowerCase()) || null
}

export function toLocationCountry(value) {
  const country = getCountryByCodeOrName(value)
  return country ? { code: country.isoCode, name: country.name } : null
}

export function toLocationState(value, countryCode) {
  const state = getStateByCodeOrName(value, countryCode)
  return state ? { code: state.isoCode, name: state.name } : null
}

export function toLocationCity(value, countryCode, stateCode) {
  const city = getCityByName(value, countryCode, stateCode)
  if (city) return { name: city.name }

  const name = typeof value === 'object' ? value?.name : value
  return name ? { name: String(name).trim() } : null
}

export function normalizePhoneForCountry(value, countryCode) {
  if (!value) return null

  const countryCodeInput = typeof value === 'object' ? value.countryCode : undefined
  const rawValue = typeof value === 'object'
    ? value.e164 || (value.countryCode && value.nationalNumber
      ? `${value.countryCode.startsWith('+') ? value.countryCode : `+${value.countryCode}`}${value.nationalNumber}`
      : value.nationalNumber)
    : value
  const text = String(rawValue || '').trim()

  if (!text) return null

  const parsed = countryCodeInput
    ? parsePhoneNumberFromString(text)
    : parsePhoneNumberFromString(text, countryCode)
  if (!parsed || !parsed.isValid()) return null

  return {
    countryCode: `+${parsed.countryCallingCode}`,
    nationalNumber: parsed.nationalNumber,
    e164: parsed.number,
  }
}

const locationOptionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
})

export const profileSchema = z.object({
  location: z.object({
    country: locationOptionSchema.nullable(),
    state: locationOptionSchema.nullable(),
    city: z.object({
      name: z.string().min(1),
    }).nullable(),
  }),
  phone: z.object({
    countryCode: z.string().min(1),
    nationalNumber: z.string().min(1),
    e164: z.string().min(1),
  }).nullable(),
}).superRefine((data, ctx) => {
  const { location, phone } = data

  if (!location.country?.code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Country is required.',
      path: ['location', 'country'],
    })
    return
  }

  const country = Country.getCountryByCode(location.country.code)
  if (!country) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select a valid country.',
      path: ['location', 'country'],
    })
    return
  }

  const states = State.getStatesOfCountry(location.country.code)
  if (states.length > 0 && !location.state?.code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'State is required.',
      path: ['location', 'state'],
    })
  }

  if (location.state?.code && !states.some((state) => state.isoCode === location.state.code)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${location.state.name} does not belong to ${location.country.name}.`,
      path: ['location', 'state'],
    })
  }

  const cities = location.state?.code
    ? City.getCitiesOfState(location.country.code, location.state.code)
    : []

  if (cities.length > 0 && !location.city?.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'City is required.',
      path: ['location', 'city'],
    })
  }

  if (location.state?.code && location.city?.name && cities.length > 0) {
    const hasCity = cities.some((city) => city.name.toLowerCase() === location.city.name.toLowerCase())
    if (!hasCity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${location.city.name} does not belong to ${location.state.name}.`,
        path: ['location', 'city'],
      })
    }
  }

  if (!phone?.e164) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number is required.',
      path: ['phone'],
    })
    return
  }

  const parsedPhone = parsePhoneNumberFromString(phone.e164)
  if (!parsedPhone?.isValid()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid phone number format.',
      path: ['phone'],
    })
    return
  }

  const providedPhoneCode = phone.countryCode?.trim()
  if (providedPhoneCode) {
    const normalizedProvided = providedPhoneCode.replace(/^\+/, '')
    if (normalizedProvided !== String(parsedPhone.countryCallingCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone country code does not match the phone number.',
        path: ['phone'],
      })
      return
    }
  }
})

export function profileSchemaIssuesToErrors(issues) {
  return issues.reduce((errors, issue) => {
    const path = issue.path.join('.')
    if (path === 'location.country') errors['location.country'] = issue.message
    else if (path === 'location.state') errors['location.state'] = issue.message
    else if (path === 'location.city') errors['location.city'] = issue.message
    else if (path === 'phone') errors['personal.phone'] = issue.message
    return errors
  }, {})
}
