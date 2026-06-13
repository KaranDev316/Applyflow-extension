/* global describe,it,expect */
import { profileSchema } from './profileValidation'

describe('Profile Validation Schema', () => {
  it('passes with a valid country, state, city, and phone', () => {
    const validData = {
      location: {
        country: { code: 'IN', name: 'India' },
        state: { code: 'GJ', name: 'Gujarat' },
        city: { name: 'Ahmedabad' },
      },
      phone: {
        countryCode: '+91',
        nationalNumber: '7086226205',
        e164: '+917086226205',
      },
    }
    
    const result = profileSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('fails when state does not belong to the selected country', () => {
    const invalidStateData = {
      location: {
        country: { code: 'IN', name: 'India' },
        state: { code: 'TX', name: 'Texas' }, // Texas is in the US
        city: null,
      },
      phone: null,
    }
    
    const result = profileSchema.safeParse(invalidStateData)
    expect(result.success).toBe(false)
    
    const stateIssue = result.error.issues.find(issue => issue.path.includes('state'))
    expect(stateIssue).toBeDefined()
    expect(stateIssue.message).toBe('Texas does not belong to India.')
  })

  it('fails when city does not belong to the selected state', () => {
    const invalidCityData = {
      location: {
        country: { code: 'IN', name: 'India' },
        state: { code: 'MH', name: 'Maharashtra' },
        city: { name: 'Ahmedabad' }, // Ahmedabad is in Gujarat
      },
      phone: null,
    }
    
    const result = profileSchema.safeParse(invalidCityData)
    expect(result.success).toBe(false)
    
    const cityIssue = result.error.issues.find(issue => issue.path.includes('city'))
    expect(cityIssue).toBeDefined()
    expect(cityIssue.message).toBe('Ahmedabad does not belong to Maharashtra.')
  })

  it('passes when phone country code differs from location country', () => {
    const validPhoneData = {
      location: {
        country: { code: 'IN', name: 'India' },
        state: null,
        city: null,
      },
      phone: {
        countryCode: '+1',
        nationalNumber: '2025550173',
        e164: '+12025550173', // A US phone number
      },
    }

    const result = profileSchema.safeParse(validPhoneData)
    expect(result.success).toBe(true)
  })

  it('fails when phone country code does not match the phone number', () => {
    const invalidPhoneData = {
      location: {
        country: { code: 'IN', name: 'India' },
        state: null,
        city: null,
      },
      phone: {
        countryCode: '+44',
        nationalNumber: '2025550173',
        e164: '+12025550173',
      },
    }

    const result = profileSchema.safeParse(invalidPhoneData)
    expect(result.success).toBe(false)

    const phoneIssue = result.error.issues.find(issue => issue.path.includes('phone'))
    expect(phoneIssue).toBeDefined()
    expect(phoneIssue.message).toBe('Phone country code does not match the phone number.')
  })
})