export const CURRENCY = 'BDT'

export const EXPENSE_CATEGORIES = [
  'equipment',
  'transport',
  'venue',
  'food',
  'decoration',
  'materials',
  'printing',
  'marketing',
  'misc',
]

export const CONTRIBUTION_TYPES = [
  { value: 'cash', label: 'Cash / Sponsorship', hint: 'Money received from a contributor or sponsor' },
  { value: 'material', label: 'Material', hint: 'Paint, supplies, raw materials, components…' },
  { value: 'asset', label: 'Physical Asset', hint: 'Camera, laptop, vehicle, equipment…' },
  { value: 'in_kind', label: 'In-kind / Access', hint: 'House, studio, venue or facility access' },
]

export const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

export const PROJECT_CATEGORIES = [
  'event', 'film', 'social', 'business', 'research', 'construction', 'other',
]

export const RESOURCE_STATUSES = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'committed', label: 'Committed' },
  { value: 'available', label: 'Received / Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_use', label: 'In Use' },
  { value: 'returned', label: 'Returned' },
  { value: 'unavailable', label: 'Unavailable' },
]

export const OWNERSHIP_STATUSES = [
  { value: 'contributor_retained', label: 'Retained by contributor' },
  { value: 'transferred', label: 'Transferred to project' },
  { value: 'undetermined', label: 'Undetermined' },
]

export const EXPENSE_SOURCES = [
  { value: 'advance', label: 'Money I received (advance)' },
  { value: 'personal', label: 'My own money' },
  { value: 'project_cash', label: 'Project cash in hand' },
]

export const PAYMENT_METHODS = ['cash', 'bkash', 'nagad', 'bank', 'other']

export const NOTIFICATION_KINDS = {
  verification_requested: { icon: 'shield', tone: 'amber' },
  verification_completed: { icon: 'check', tone: 'green' },
  verification_rejected: { icon: 'x', tone: 'red' },
  clarification_requested: { icon: 'help', tone: 'amber' },
  advance_received: { icon: 'wallet', tone: 'blue' },
  contribution_added: { icon: 'gift', tone: 'green' },
  reimbursement_created: { icon: 'receipt', tone: 'blue' },
  reimbursement_paid: { icon: 'check', tone: 'green' },
  resource_assigned: { icon: 'box', tone: 'blue' },
  resource_returned: { icon: 'box', tone: 'green' },
  member_joined: { icon: 'users', tone: 'blue' },
  invitation: { icon: 'mail', tone: 'blue' },
  project_updated: { icon: 'folder', tone: 'blue' },
}

export const MAX_FILE_SIZE_MB = 10
export const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
