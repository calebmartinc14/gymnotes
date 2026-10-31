import { describe, it, expect, afterEach } from 'vitest'
import {
  bmiCategoryLabel,
  detectLocale,
  exerciseLabel,
  isLocale,
  levelLabel,
  muscleLabel,
  translate,
} from './i18n'
import { en } from './locales/en'
import { es } from './locales/es'

afterEach(() => {
  localStorage.removeItem('gymnotes:locale')
})

describe('translate', () => {
  it('returns the English string for a key', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard')
  })

  it('returns the Spanish string for a key', () => {
    expect(translate('es', 'nav.dashboard')).toBe('Panel')
  })

  it('interpolates variables', () => {
    expect(translate('en', 'dash.bmiValue', { value: 24.7 })).toBe('24.7 BMI')
    expect(translate('es', 'dash.bmiValue', { value: 24.7 })).toBe('24.7 de IMC')
  })

  it('picks the one/other plural form from count', () => {
    expect(translate('en', 'log.setCount', { count: 1 })).toBe('1 set')
    expect(translate('en', 'log.setCount', { count: 3 })).toBe('3 sets')
    expect(translate('es', 'log.setCount', { count: 1 })).toBe('1 serie')
    expect(translate('es', 'log.setCount', { count: 3 })).toBe('3 series')
  })

  it('falls back to the key when unknown', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })
})

describe('dictionaries', () => {
  it('Spanish covers every English key', () => {
    const missing = Object.keys(en).filter((key) => !(key in es))
    expect(missing).toEqual([])
  })

  it('has no empty translations', () => {
    for (const [key, value] of Object.entries(es)) {
      expect(value, key).not.toBe('')
    }
  })
})

describe('detectLocale', () => {
  it('prefers a stored locale', () => {
    localStorage.setItem('gymnotes:locale', 'es')
    expect(detectLocale()).toBe('es')
  })
})

describe('isLocale', () => {
  it('accepts only known locales', () => {
    expect(isLocale('es')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})

describe('label helpers', () => {
  it('translates library exercises by id', () => {
    const t = (key: string) => translate('es', key)
    expect(exerciseLabel({ id: 'bench-press', name: 'Bench Press' }, t)).toBe('Press de banca')
  })

  it('keeps custom exercise names untouched', () => {
    const t = (key: string) => translate('es', key)
    expect(exerciseLabel({ id: 'custom-1', name: 'Mi ejercicio', custom: true }, t)).toBe(
      'Mi ejercicio',
    )
  })

  it('translates muscle groups, levels and BMI categories', () => {
    const t = (key: string) => translate('es', key)
    expect(muscleLabel('Chest', t)).toBe('Pecho')
    expect(levelLabel('Elite', t)).toBe('Élite')
    expect(bmiCategoryLabel('Healthy range', t)).toBe('Rango saludable')
    expect(bmiCategoryLabel('Unknown', t)).toBe('Unknown')
  })
})
