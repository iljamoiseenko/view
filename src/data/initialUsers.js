const today = new Date()
const addDays = (d, n) => new Date(d.getTime() + n * 86400000).toISOString().split('T')[0]

export const initialUsers = [
  {
    id: 'u1',
    email: 'admin@goout.ua',
    password: 'Admin2024',
    role: 'superadmin',
    name: 'Головний адміністратор',
    placeId: null,
    isActive: true,
    createdAt: addDays(today, -60),
    subscription: {
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: addDays(today, 30),
    },
  },
  {
    id: 'u2',
    email: 'modna@goout.ua',
    password: 'venue123',
    role: 'venue',
    name: 'Модна Кухня',
    placeId: '1',
    isActive: true,
    createdAt: addDays(today, -5),
    subscription: {
      status: 'trial',
      trialEndsAt: addDays(today, 9),   // 14 days from creation
      currentPeriodEnd: null,
    },
  },
  {
    id: 'u3',
    email: 'skybar@goout.ua',
    password: 'venue123',
    role: 'venue',
    name: 'SkyBar Lounge',
    placeId: '8',
    isActive: true,
    createdAt: addDays(today, -40),
    subscription: {
      status: 'active',
      trialEndsAt: addDays(today, -26),
      currentPeriodEnd: addDays(today, 20),
    },
  },
  {
    id: 'u4',
    email: 'jazzbar@goout.ua',
    password: 'venue123',
    role: 'venue',
    name: 'Jazz Corner',
    placeId: '10',
    isActive: true,
    createdAt: addDays(today, -20),
    subscription: {
      status: 'inactive',
      trialEndsAt: addDays(today, -6),
      currentPeriodEnd: null,
    },
  },
]
