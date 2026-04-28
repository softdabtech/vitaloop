import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signupSchema = loginSchema.extend({
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Name required').max(100),
  age: z.number().int().min(1).max(150).nullable().optional(),
  sex: z.enum(['male', 'female', 'other', '']).optional(),
  timezone: z.string().min(1),
})

export const medicalSchema = z.object({
  height_cm: z.number().int().min(100).max(250).nullable().optional(),
  weight_kg: z.number().min(30).max(300).nullable().optional(),
  goals: z.array(z.string()).optional(),
})

export const onboardingSchema = z.object({
  height_cm: z.number().int().min(100, 'Height must be 100-300cm'),
  weight_kg: z.number().min(30, 'Weight must be 30-300kg'),
  goals: z.array(z.string()).min(1, 'Select at least one goal'),
})

export const checkInSchema = z.object({
  feeling: z.string().min(1, 'Select how you feel'),
  sleep_stars: z.number().int().min(1).max(5),
  adherence: z.string().min(1, 'Select adherence'),
  changes: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type MedicalInput = z.infer<typeof medicalSchema>
