import { resolveUserDestination } from '../src/lib/routing/user-destination'

type Case = {
  name: string
  profile: {
    role?: string | null
    school_id?: string | null
    is_super_admin?: boolean | null
  } | null
  schoolSlug?: string | null
  expected: string
}

const cases: Case[] = [
  {
    name: 'brand new user goes to onboarding',
    profile: { role: null, school_id: null, is_super_admin: false },
    expected: '/onboarding',
  },
  {
    name: 'missing profile also goes to onboarding',
    profile: null,
    expected: '/onboarding',
  },
  {
    name: 'teacher with school goes to teacher route',
    profile: { role: 'teacher', school_id: 'school-1', is_super_admin: false },
    schoolSlug: 'greenfield',
    expected: '/greenfield/teacher',
  },
  {
    name: 'student with school goes to student route',
    profile: { role: 'student', school_id: 'school-1', is_super_admin: false },
    schoolSlug: 'greenfield',
    expected: '/greenfield/student',
  },
  {
    name: 'admin with school goes to admin route',
    profile: { role: 'admin', school_id: 'school-1', is_super_admin: false },
    schoolSlug: 'greenfield',
    expected: '/greenfield/admin',
  },
  {
    name: 'admin without school goes to register-school',
    profile: { role: 'admin', school_id: null, is_super_admin: false },
    expected: '/register-school',
  },
  {
    name: 'super admin flag wins',
    profile: { role: 'teacher', school_id: null, is_super_admin: true },
    expected: '/superadmin',
  },
  {
    name: 'super admin role wins',
    profile: { role: 'super_admin', school_id: null, is_super_admin: false },
    expected: '/superadmin',
  },
  {
    name: 'teacher without school falls back to dashboard',
    profile: { role: 'teacher', school_id: null, is_super_admin: false },
    expected: '/dashboard',
  },
]

let failures = 0

for (const testCase of cases) {
  const actual = resolveUserDestination(testCase.profile, testCase.schoolSlug)
  const passed = actual === testCase.expected

  if (!passed) {
    failures += 1
  }

  const marker = passed ? 'PASS' : 'FAIL'
  console.log(`${marker} ${testCase.name}`)

  if (!passed) {
    console.log(`  expected: ${testCase.expected}`)
    console.log(`  actual:   ${actual}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} routing verification case(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${cases.length} routing verification cases passed.`)