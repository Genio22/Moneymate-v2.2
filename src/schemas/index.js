import { z } from 'zod'
import { parseTakaToPoisha } from '../utils/money'

const amount = z
  .string()
  .min(1, 'Enter an amount')
  .refine((v) => parseTakaToPoisha(v) !== null, 'Enter a valid amount (e.g. 450 or 450.50)')
  .refine((v) => (parseTakaToPoisha(v) ?? 0) > 0, 'Amount must be greater than zero')

export const expenseSchema = z.object({
  project_id: z.string().uuid({ message: 'Choose a project' }),
  title: z.string().trim().min(2, 'What did you buy? (min 2 characters)').max(200),
  amount: amount,
  purchased_on: z.string().min(1, 'Choose the purchase date'),
  category: z.string().min(1, 'Choose what it was for'),
  funding_source: z.enum(['advance', 'personal', 'project_cash']),
  advance_id: z.string().uuid().or(z.literal('')).nullish(),
  allocation_id: z.string().uuid().or(z.literal('')).nullish(),
  vendor: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(1000).nullish(),
}).superRefine((data, ctx) => {
  if (data.funding_source === 'advance' && !data.advance_id) {
    ctx.addIssue({ code: 'custom', path: ['advance_id'], message: 'Choose which advance you spent from' })
  }
})

export const contributionBase = {
  contribution_type: z.enum(['cash', 'material', 'asset', 'in_kind']),
  contributor_mode: z.enum(['self', 'other', 'external']),
  contributor_name: z.string().trim().min(2, 'Who provided it?').max(120),
  title: z.string().trim().min(2, 'Give it a short title').max(160),
  description: z.string().trim().max(1000).nullish(),
  amount: amount,
  received_on: z.string().min(1, 'Choose the date'),
  quantity: z.string().optional(),
  unit: z.string().trim().max(40).nullish(),
  location: z.string().trim().max(160).nullish(),
  ownership_status: z.enum(['contributor_retained', 'transferred', 'undetermined']).default('undetermined'),
  usage_start: z.string().nullish(),
  usage_end: z.string().nullish(),
  usage_conditions: z.string().trim().max(500).nullish(),
  restricted: z.boolean().default(false),
}

export const contributionSchema = z.object(contributionBase).superRefine((data, ctx) => {
  if (data.contribution_type === 'in_kind') {
    if (!data.usage_start) ctx.addIssue({ code: 'custom', path: ['usage_start'], message: 'Choose the start date' })
    if (!data.usage_end) ctx.addIssue({ code: 'custom', path: ['usage_end'], message: 'Choose the end date' })
    if (data.usage_start && data.usage_end && data.usage_end < data.usage_start) {
      ctx.addIssue({ code: 'custom', path: ['usage_end'], message: 'End date must be after the start date' })
    }
  }
})

export const advanceSchema = z.object({
  provider_mode: z.enum(['self', 'member', 'external']),
  provider_user_id: z.string().uuid().nullish(),
  provider_name: z.string().trim().max(120).nullish(),
  custodian_id: z.string().uuid({ message: 'Choose who will hold the money' }),
  amount: amount,
  funding_source: z.enum(['own_funds', 'project_cash']),
  purpose: z.string().trim().max(500).nullish(),
  provided_on: z.string().min(1, 'Choose the date'),
}).superRefine((data, ctx) => {
  if (data.provider_mode === 'external' && !(data.provider_name || '').trim()) {
    ctx.addIssue({ code: 'custom', path: ['provider_name'], message: 'Enter the provider name' })
  }
})

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required').max(120),
  description: z.string().trim().max(2000).nullish(),
  category: z.string().min(1, 'Choose a category'),
  start_date: z.string().min(1, 'Choose a start date'),
  expected_end_date: z.string().nullish(),
  initial_budget: z.string().refine((v) => v === '' || parseTakaToPoisha(v) !== null, 'Enter a valid amount').nullish(),
  status: z.enum(['draft', 'active', 'on_hold', 'completed', 'archived']).default('active'),
})

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().max(20).nullish(),
})

export const resourceSchema = z.object({
  name: z.string().trim().min(2, 'Resource name is required').max(160),
  resource_type: z.enum(['material', 'asset', 'access', 'other']),
  description: z.string().trim().max(1000).nullish(),
  owner_mode: z.enum(['self', 'member', 'external']),
  owner_user_id: z.string().uuid().nullish(),
  owner_name: z.string().trim().max(120).nullish(),
  ownership_status: z.enum(['contributor_retained', 'transferred', 'undetermined']).default('undetermined'),
  quantity: z.string().optional(),
  unit: z.string().trim().max(40).nullish(),
  agreed_value: z.string().refine((v) => v === '' || parseTakaToPoisha(v) !== null, 'Enter a valid amount').nullish(),
  custodian_id: z.string().uuid().nullish(),
  location: z.string().trim().max(160).nullish(),
  status: z.enum(['proposed', 'committed', 'available', 'assigned', 'in_use', 'returned', 'unavailable']).default('proposed'),
  returnable: z.boolean().default(true),
  usage_start: z.string().nullish(),
  usage_end: z.string().nullish(),
  usage_conditions: z.string().trim().max(500).nullish(),
  source_contribution_id: z.string().uuid().nullish(),
})

export const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['manager', 'member', 'viewer']),
})

export const settleSchema = z.object({
  amount: amount,
  paid_on: z.string().min(1, 'Choose the payment date'),
  method: z.string().min(1),
  reference: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(500).nullish(),
})
